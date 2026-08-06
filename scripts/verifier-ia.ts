import { execFileSync } from "node:child_process";
import { decrireEtatIA, aFaireIA, type EtatFournisseur } from "../src/lib/etat-ia";
import { getConfigIA } from "../src/server/ai/config";
import { getFournisseurLLM } from "../src/server/ai/providers/llm/fabrique";

/**
 * **« Est-ce que l'IA est branchée ? »** — la commande qui répond.
 *
 * Elle existe parce que la question a été posée un jour où personne ne pouvait
 * y répondre sans lire quatre fichiers du dépôt. Le patron avait enregistré ses
 * clés, l'application les ignorait, et le seul symptôme visible était un devis
 * recopié mot à mot — rien qui désigne la configuration.
 *
 * Deux usages :
 *
 *   npm run verifier:ia            configuration seule, aucun appel réseau
 *   npm run verifier:ia -- --reseau   appelle réellement les fournisseurs
 *
 * **Ce contrôle sait échouer**, et c'est sa raison d'être : il sort en erreur
 * dès qu'un fournisseur est choisi mais inutilisable — clé absente, nom
 * inconnu, fournisseur non implémenté. Le mode déterministe complet, lui, est
 * un état légitime : il est annoncé, pas sanctionné.
 */

const AVEC_RESEAU = process.argv.includes("--reseau");

// Lit le même `.env.local` que l'application au démarrage. Sans cela, cette
// commande aurait répondu « mode déterministe » à quelqu'un dont les clés
// fonctionnent — un diagnostic qui se trompe est pire que pas de diagnostic.
//
// Passe par `charger-cles.sh`, et pas par `process.loadEnvFile`, pour la même
// raison que `demarrer.sh` : le modèle de fichier écrit d'avance contient des
// lignes VIDES, qui écraseraient des clés déjà posées dans l'environnement.
// Une seule règle de chargement, un seul endroit où elle est éprouvée
// (`CLAUDE.md` §3).
try {
  const script = new URL("../.devcontainer/charger-cles.sh", import.meta.url).pathname;
  const fichier = new URL("../.env.local", import.meta.url).pathname;
  const sortie = execFileSync("bash", [script, fichier], { encoding: "utf8" });
  for (const ligne of sortie.split("\n")) {
    const separateur = ligne.indexOf("=");
    if (separateur > 0) process.env[ligne.slice(0, separateur)] = ligne.slice(separateur + 1);
  }
} catch {
  // Fichier absent, ou script injoignable : c'est le cas courant hors espace
  // d'essai, et ce n'est pas une anomalie.
}

// L'état vient de `src/lib/etat-ia.ts` — le MÊME que celui affiché à l'écran
// Réglages. Deux descriptions de la même configuration auraient fini par se
// contredire, et c'est celle qu'on relit le moins qui serait restée fausse
// (`CLAUDE.md` §3).
function etatComplet(): EtatFournisseur[] {
  const config = getConfigIA();
  const cles = [
    config.anthropicApiKey ? "ANTHROPIC_API_KEY" : "",
    config.openaiApiKey ? "OPENAI_API_KEY" : "",
    config.geminiApiKey ? "GEMINI_API_KEY" : "",
    config.deepgramApiKey ? "DEEPGRAM_API_KEY" : "",
    config.googleApiKey ? "GOOGLE_API_KEY" : "",
  ].filter(Boolean);
  return decrireEtatIA(config.transcriptionProvider, config.llmProvider, cles);
}

function ligne(etat: EtatFournisseur) {
  const marque = etat.nature === "reel" ? "✅" : etat.nature === "simule" ? "○" : "❌";
  console.log(`  ${marque} ${etat.role.padEnd(13)} : ${etat.libelle}`);
  console.log(`       ${etat.explication}`);
}

async function appelReel(etats: EtatFournisseur[]): Promise<boolean> {
  let toutVaBien = true;
  const config = getConfigIA();
  const [transcription] = etats;
  const redaction = etats[1];

  if (redaction.nature === "reel") {
    process.stdout.write(`  … appel réel à ${redaction.libelle} `);
    const resultat = await getFournisseurLLM().genererTexte(
      "Réponds exactement le mot OK, sans rien d'autre.",
      "Dis OK."
    );
    if (resultat.succes) {
      console.log(`→ réponse reçue (« ${resultat.texte.trim().slice(0, 40)} »)`);
    } else {
      console.log(`→ ÉCHEC : ${resultat.erreur.type} — ${resultat.erreur.message}`);
      toutVaBien = false;
    }
  }

  // La transcription ne s'éprouve pas sans un fichier audio, et un faux audio
  // ne prouverait rien. On vérifie donc ce qui compte et se vérifie vraiment :
  // que la clé est acceptée par le fournisseur.
  if (transcription.nature === "reel" && config.transcriptionProvider.toLowerCase() === "openai") {
    process.stdout.write(`  … clé acceptée par ${transcription.libelle} `);
    try {
      const reponse = await fetch(`${config.openaiBaseUrl}/v1/models`, {
        headers: { Authorization: `Bearer ${config.openaiApiKey}` },
      });
      if (reponse.ok) {
        console.log("→ oui");
      } else {
        console.log(`→ NON : HTTP ${reponse.status}${reponse.status === 401 ? " (clé refusée)" : ""}`);
        toutVaBien = false;
      }
    } catch (err) {
      console.log(`→ injoignable : ${err instanceof Error ? err.message : String(err)}`);
      toutVaBien = false;
    }
  }

  return toutVaBien;
}

async function main() {
  const etats = etatComplet();
  const [transcription] = etats;

  console.log("\n── Fournisseurs d'IA d'Atlas ──────────────────\n");
  for (const etat of etats) ligne(etat);
  const conseil = aFaireIA(etats);
  if (conseil) console.log(`\n  ${conseil}`);
  console.log();

  // Choisi mais inutilisable : c'est une panne, pas un choix. Le mode
  // déterministe assumé (aucune clé, aucun fournisseur nommé) n'en est pas une.
  const enPanne = etats.filter(
    (e) => e.nature === "cle_absente" || e.nature === "non_raccorde" || e.libelle.includes("n'est pas reconnu")
  );

  // **Un rôle branché suffit à déclencher l'appel réel.** La première version
  // exigeait que les deux le soient : avec la seule clé Anthropic posée, elle
  // annonçait « aucun fournisseur n'est utilisable » alors que la rédaction
  // partait bel et bien chez un tiers. Trouvé en la lançant, pas en la
  // relisant.
  const auMoinsUn = etats.some((e) => e.nature === "reel");
  let reseauOk = true;
  if (AVEC_RESEAU && auMoinsUn) {
    console.log("── Appels réels ───────────────────────────────\n");
    reseauOk = await appelReel(etats);
    console.log();
  } else if (AVEC_RESEAU) {
    console.log("  (aucun appel réel : aucun fournisseur n'est utilisable)\n");
  }

  if (enPanne.length > 0) {
    console.error("❌ Un fournisseur est choisi mais inutilisable — voir ci-dessus.");
    process.exit(1);
  }
  if (!reseauOk) {
    console.error("❌ Le fournisseur est configuré mais l'appel réel a échoué.");
    process.exit(1);
  }
  // Le dernier mot doit être exact, parce que c'est le seul qu'on retient.
  // Une version antérieure écrivait « aucune donnée ne sort » alors qu'un
  // fournisseur sur deux était branché : dire cela d'une application qui
  // envoie le nom et l'adresse d'un client chez un tiers serait un mensonge,
  // et c'est précisément ce qu'on demande à cette commande de trancher.
  if (etats.every((e) => e.nature === "reel")) {
    console.log("✅ L'IA est branchée.");
  } else if (auMoinsUn) {
    console.log(
      `⚠ À moitié branchée : ${transcription.nature === "reel" ? "la transcription part" : "la rédaction part"} chez un tiers, l'autre reste déterministe.`
    );
  } else {
    console.log("○ Mode déterministe assumé : aucune clé posée, aucune donnée ne sort.");
  }
}

main().catch((e) => {
  // `getEnv()` valide TOUTE la configuration, base de données comprise.
  // Lancée hors de l'espace de travail, cette commande accusait donc
  // « DATABASE_URL manquante » à quelqu'un venu poser une question sur l'IA —
  // une erreur qui envoie chercher au mauvais endroit coûte plus cher que pas
  // d'erreur du tout (`AGENTS.md`).
  if (e instanceof Error && e.name === "ErreurConfiguration" && e.message.includes("DATABASE_URL")) {
    console.error(
      "\n❌ Cette commande se lance depuis l'espace de travail d'Atlas, où la base est configurée.\n" +
        "   (Rien à voir avec l'IA : c'est DATABASE_URL qui manque.)"
    );
    process.exit(1);
  }
  console.error(e);
  process.exit(1);
});
