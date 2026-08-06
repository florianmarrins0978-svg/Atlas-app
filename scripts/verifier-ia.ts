import { etatIA } from "../src/server/ai/diagnostic";
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
try {
  process.loadEnvFile(new URL("../.env.local", import.meta.url).pathname);
} catch {
  // Fichier absent : c'est le cas courant, et ce n'est pas une anomalie.
}

function ligne(titre: string, etat: ReturnType<typeof etatIA>["redaction"]) {
  const marque = etat.branche ? "✅" : etat.fournisseur === "dev" && !etat.motif?.includes("que l'application ne connaît pas") ? "○" : "❌";
  console.log(`  ${marque} ${titre} : ${etat.nomLisible}`);
  if (etat.motif) console.log(`       ${etat.motif}`);
  if (etat.variableManquante) {
    console.log(`       À poser dans les secrets de l'espace de travail : ${etat.variableManquante}`);
  }
}

async function appelReel(): Promise<boolean> {
  let toutVaBien = true;
  const config = getConfigIA();
  const etat = etatIA();

  if (etat.redaction.branche) {
    process.stdout.write(`  … appel réel à ${etat.redaction.nomLisible} `);
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
  if (etat.transcription.branche && etat.transcription.fournisseur === "openai") {
    process.stdout.write(`  … clé acceptée par ${etat.transcription.nomLisible} `);
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
  const etat = etatIA();

  console.log("\n── Fournisseurs d'IA d'Atlas ──────────────────\n");
  ligne("Transcription de la dictée", etat.transcription);
  ligne("Rédaction du devis        ", etat.redaction);
  console.log(`\n  ${etat.resume}\n`);

  // Choisi mais inutilisable : c'est une panne, pas un choix. Le mode
  // déterministe assumé (aucune clé, aucun fournisseur nommé) n'en est pas une.
  const enPanne = [etat.transcription, etat.redaction].filter(
    (r) => !r.branche && (r.variableManquante || r.motif?.includes("non implémenté") || r.motif?.includes("ne connaît pas"))
  );

  // **Un rôle branché suffit à déclencher l'appel réel.** La première version
  // exigeait que les deux le soient : avec la seule clé Anthropic posée, elle
  // annonçait « aucun fournisseur n'est utilisable » alors que la rédaction
  // partait bel et bien chez un tiers. Trouvé en la lançant, pas en la
  // relisant.
  const auMoinsUn = etat.redaction.branche || etat.transcription.branche;
  let reseauOk = true;
  if (AVEC_RESEAU && auMoinsUn) {
    console.log("── Appels réels ───────────────────────────────\n");
    reseauOk = await appelReel();
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
  if (etat.toutBranche) {
    console.log("✅ L'IA est branchée.");
  } else if (auMoinsUn) {
    console.log(
      `⚠ À moitié branchée : ${etat.transcription.branche ? "la transcription part" : "la rédaction part"} chez un tiers, l'autre reste déterministe.`
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
