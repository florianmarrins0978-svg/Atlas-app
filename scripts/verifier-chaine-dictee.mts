import { execFileSync } from "node:child_process";
import { getFournisseurLLM } from "../src/server/ai/providers/llm/fabrique";
import { getConfigIA } from "../src/server/ai/config";
import { extraire } from "../src/server/ai/services/extraction-service";
import { structureDeLaPrestation } from "../src/lib/prestation-structuree";
import { lignesVendables } from "../src/lib/lignes-vendables";
import { quantiteCommerciale } from "../src/lib/quantite-commerciale";
import { nature } from "../src/lib/natures-prestation";
import { signatureV2 } from "../src/lib/comparabilite-prix";
import type { PropositionExtraction } from "../src/server/ai/schemas/extraction";

/**
 * **La chaîne dictée → devis, jouée avec sa vraie clé.**
 *
 * ─── Pourquoi une commande à part, hors de la batterie ──────────────────────
 *
 * Ce qui suit dépend de ce qu'un modèle de langage RÉPOND. Sans clé, il n'y a
 * rien à mesurer, et l'environnement de développement de l'agent n'en a aucune
 * (`CLAUDE.md` §1 ter). Un contrôle qui mesure zéro est pire qu'absent : celui-ci
 * refuse donc de rendre un vert quand il n'a rien appelé.
 *
 *   npm run verifier:chaine-dictee     depuis son espace, où ses clés sont posées
 *
 * ─── Ce qu'il NE fait pas, et il faut le savoir ─────────────────────────────
 *
 * **Il n'écrit RIEN en base.** Aucun chantier créé, aucune prestation, aucun
 * devis : il joue le modèle et les fonctions pures, et montre ce qui en sort.
 * Ce qui dépend de SES prix de grille — le montant des lignes — se regarde dans
 * l'application, en dictant pour de bon.
 *
 * **Il ne joue pas Whisper.** La transcription demande un vrai fichier son ;
 * ici on part du texte, comme si la dictée avait déjà été transcrite.
 */

// Même chargement de clés que `verifier-ia.ts` : le modèle de `.env.local`
// contient des lignes vides qui écraseraient des clés déjà posées.
try {
  const script = new URL("../.devcontainer/charger-cles.sh", import.meta.url).pathname;
  const fichier = new URL("../.env.local", import.meta.url).pathname;
  for (const ligne of execFileSync("bash", [script, fichier], { encoding: "utf8" }).split("\n")) {
    const separateur = ligne.indexOf("=");
    if (separateur > 0) process.env[ligne.slice(0, separateur)] = ligne.slice(separateur + 1);
  }
} catch {
  // Hors de son espace, ce fichier n'existe pas : ce n'est pas une anomalie.
}

/** Sa dictée de référence, celle du 27 août 2026. */
const SA_DICTEE =
  "Taille de 800 mètres linéaires de haie de laurier, démontage d'un érable de 40 cm de " +
  "diamètre et 12 mètres de haut avec rétention, dessouchage de deux souches de 60 cm, " +
  "évacuation des déchets et tonte de 1 200 mètres carrés de pelouse, prévoir deux hommes " +
  "pendant une journée.";

/** Ce que la chaîne doit conserver, et que rien ne doit transformer en silence. */
export const ATTENDU: { quoi: string; verifier: (r: Lu) => string | null }[] = [
  {
    quoi: "la haie : 800 ml, laurier",
    verifier: (r) => {
      const h = r.prestations.find((p) => p.nature === "haie");
      if (!h) return "aucune prestation de nature « haie »";
      if (Number(h.quantite) !== 800) return `quantité : ${h.quantite ?? "—"}`;
      if (h.unite !== "ml") return `unité : ${h.unite ?? "—"}`;
      if (!h.espece || !/laurier/i.test(h.espece)) return `espèce : ${h.espece ?? "—"}`;
      return null;
    },
  },
  {
    quoi: "le démontage : érable, en rétention",
    verifier: (r) => {
      const a = r.prestations.find((p) => p.nature === "abattage");
      if (!a) return "aucune prestation de nature « abattage »";
      if (!a.espece || !/[ée]rable/i.test(a.espece)) return `espèce : ${a.espece ?? "—"}`;
      return null;
    },
  },
  {
    quoi: "le dessouchage : 2 souches",
    verifier: (r) => {
      const d = r.prestations.find((p) => p.nature === "dessouchage");
      if (!d) return "aucune prestation de nature « dessouchage »";
      if (Number(d.quantite) !== 2) return `quantité : ${d.quantite ?? "—"}`;
      if (!d.unite) return "unité absente : un nombre sans unité ne veut rien dire";
      return null;
    },
  },
  {
    quoi: "l'évacuation des déchets existe",
    verifier: (r) =>
      r.prestations.some((p) => p.nature === "evacuation") ? null : "aucune prestation d'évacuation",
  },
  {
    quoi: "la tonte : 1 200 m²",
    verifier: (r) => {
      const t = r.prestations.find((p) => p.nature === "tonte");
      if (!t) return "aucune prestation de nature « tonte »";
      if (Number(t.quantite) !== 1200) return `quantité : ${t.quantite ?? "—"}`;
      if (!t.unite || !/m/i.test(t.unite)) return `unité : ${t.unite ?? "—"}`;
      return null;
    },
  },
  {
    quoi: "l'équipe et la durée ne sont PAS des prestations",
    verifier: (r) => {
      if (!r.tailleEquipe) return "la taille d'équipe est vide";
      if (!r.dureePrevue) return "la durée est vide";
      const fautive = r.prestations.find((p) => /homme|journ[ée]e|jour\b/i.test(p.unite ?? ""));
      return fautive ? `« ${fautive.libelle} » a pris ${fautive.unite} pour une quantité` : null;
    },
  },
  {
    quoi: "la tonte ne partage AUCUNE ligne avec le démontage",
    verifier: (r) => {
      const melangee = r.lignes.find(
        (l) => /tonte|tondre/i.test(l.libelle) && /(abatt|d[ée]mont)/i.test(l.libelle)
      );
      return melangee ? `une ligne porte les deux : « ${melangee.libelle.replace(/\n/g, " / ")} »` : null;
    },
  },
  {
    quoi: "aucune nature inventée n'entre en base",
    verifier: (r) => {
      const inventee = r.brutes.find((b) => b.nature && !nature(b.nature));
      return inventee ? `« ${inventee.nature} » n'existe pas dans le référentiel` : null;
    },
  },
];

export type Lu = {
  brutes: { libelle: string; nature?: string | null }[];
  prestations: {
    libelle: string;
    nature: string | null;
    espece: string | null;
    quantite: string | null;
    unite: string | null;
  }[];
  lignes: { cle: string; libelle: string; principal: boolean }[];
  dureePrevue: string | null;
  tailleEquipe: string | null;
};

/**
 * Les colonnes que la dictée produit, prestation par prestation.
 *
 * **Exportée pour être éprouvée**, jamais pour être appelée d'ailleurs : sans
 * cela, la logique de cette commande ne serait vérifiée que par la commande
 * elle-même — c'est-à-dire nulle part tant qu'aucune clé n'est posée. Un mode
 * d'emploi qui plante chez lui est un échec qu'on a déjà payé trois fois
 * (`AGENTS.md`).
 */
export function colonnesDe(proposition: PropositionExtraction): Lu["prestations"] {
  return proposition.prestations.map((l) => ({ libelle: l.libelle, ...structureDeLaPrestation(l) }));
}

/** Toute la chaîne, depuis ce que le modèle a répondu — sans base ni réseau. */
export function lireLaChaine(proposition: PropositionExtraction): Lu {
  const prestations = colonnesDe(proposition);
  return {
    brutes: proposition.prestations,
    prestations,
    lignes: lignesVendables(prestations).lignes,
    dureePrevue: proposition.dureePrevue,
    tailleEquipe: proposition.tailleEquipe,
  };
}

async function main() {
  const config = getConfigIA();
  const fournisseur = getFournisseurLLM();

  console.log("\n=== La chaîne dictée → devis, avec sa vraie clé ===\n");
  console.log(`Fournisseur : ${fournisseur.nom}`);

  // **Refuser un vert sans appel réel.** C'est toute la raison d'être de cette
  // commande : sans clé, elle ne prouverait rien et le dirait trop tard.
  if (!config.anthropicApiKey && !config.openaiApiKey) {
    console.error(
      "\n❌ Aucune clé d'IA n'est configurée : rien n'a été appelé, et ce contrôle\n" +
        "   ne peut donc RIEN prouver. Jouez-le depuis votre espace de travail.\n" +
        "   (`npm run verifier:ia` dit quels fournisseurs répondent.)\n"
    );
    process.exit(1);
  }

  console.log("\n--- 1. Ce qui est prononcé -------------------------------------\n");
  console.log(SA_DICTEE);

  console.log("\n--- 2. Ce que le modèle en fait --------------------------------\n");
  const resultat = await extraire(SA_DICTEE);
  if (!resultat.succes) {
    console.error(`❌ L'extraction a échoué : ${resultat.erreur.message}`);
    process.exit(1);
  }
  if (resultat.lecture === "litterale") {
    console.error(
      `❌ La dictée a été RECOPIÉE mot à mot, pas comprise.\n   Motif : ${resultat.motifRepli}\n` +
        "   Ce n'est pas la chaîne qu'on éprouve ici — regardez la clé d'abord."
    );
    process.exit(1);
  }
  console.log(JSON.stringify(resultat.proposition, null, 2));

  console.log("\n--- 3. Ce qui entre dans les colonnes --------------------------\n");
  const prestations = colonnesDe(resultat.proposition);
  for (const p of prestations) {
    console.log(
      `  ${p.libelle}\n     nature ${p.nature ?? "—"} · espèce ${p.espece ?? "—"} · ` +
        `${p.quantite ?? "—"} ${p.unite ?? ""}`.trimEnd()
    );
  }

  console.log("\n--- 4. Les lignes du devis -------------------------------------\n");
  const { lignes, absorbes } = lignesVendables(prestations);
  for (const l of lignes) {
    const q = quantiteCommerciale(l.prestations);
    console.log(
      `  [${l.cle}${l.principal ? " · principale" : ""}] ${l.libelle.replace(/\n/g, " / ")}\n` +
        `     quantité vendue : ${q.quantite} ${q.unite ?? "(forfait)"} · ` +
        `chiffrage : ${nature(l.cle)?.chiffrage ?? "aucune"}`
    );
  }
  if (absorbes.length > 0) console.log(`  (compris dans l'abattage : ${absorbes.join(", ")})`);

  console.log("\n--- 5. Ce que la mémoire de prix retiendra ---------------------\n");
  for (const p of prestations) {
    const s = signatureV2({
      nature: p.nature,
      espece: p.espece,
      quantite: p.quantite,
      unite: p.unite,
    });
    console.log(`  ${p.libelle} → ${s?.cle ?? "aucune clé (nature inconnue)"}`);
  }

  console.log("\n--- 6. Le verdict ----------------------------------------------\n");
  const lu = lireLaChaine(resultat.proposition);

  let echecs = 0;
  for (const { quoi, verifier } of ATTENDU) {
    const probleme = verifier(lu);
    if (probleme) {
      echecs++;
      console.error(`  ✗ ${quoi}\n      ${probleme}`);
    } else {
      console.log(`  ✓ ${quoi}`);
    }
  }

  console.log(
    `\n${echecs === 0 ? "✅ La dictée traverse la chaîne sans rien perdre." : `❌ ${echecs} point(s) perdu(s) en route.`}\n`
  );
  console.log(
    "Ce qui reste à regarder DANS l'application, et que ce contrôle ne peut pas voir :\n" +
      "  · les montants — ils viennent de VOS prix de grille ;\n" +
      "  · la ligne « à chiffrer » sur la tonte, et le refus d'envoyer le devis ;\n" +
      "  · Whisper — il faut un vrai fichier son.\n"
  );
  if (echecs > 0) process.exitCode = 1;
}

// **Ne joue rien à l'import.** La suite qui éprouve les fonctions ci-dessus
// importe ce fichier : sans ce garde-fou, elle déclencherait un appel de modèle.
if (process.argv[1] && process.argv[1].includes("verifier-chaine-dictee")) {
  main().catch((e) => {
    console.error(e);
    process.exitCode = 1;
  });
}
