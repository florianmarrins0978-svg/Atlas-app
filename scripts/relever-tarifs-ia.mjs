// Va lire les tarifs des fournisseurs d'IA **à leur adresse publique**, et
// calcule ce que coûterait un mois d'Atlas au volume réel du patron.
//
// Pourquoi ce script existe. Le patron a demandé « combien ça me coûterait ? »
// et la réponse honnête, depuis l'environnement de développement, était « je ne
// peux pas savoir » : son mandataire réseau répond `403 Forbidden` sur les
// pages tarifaires de tous les prestataires — Deepgram, OpenAI, Google, Gladia,
// Scaleway, Mistral, et anthropic.com. C'est écrit noir sur blanc dans
// `docs/TRANSCRIPTION.md`, qui ne contient donc aucun chiffre.
//
// Un chiffre inventé ferait choisir de travers, et ne se découvrirait qu'à la
// première facture. La mesure est donc faite par une machine qui, elle, a accès
// — comme `pages.yml` pour le site publié, `banc-essai.yml` pour l'espace de
// travail et `relever-palette.yml` pour les modèles du patron.
//
// Ce qu'il ne fait pas : deviner. Une page injoignable, ou un tarif qu'il ne
// reconnaît pas dedans, est **rapportée comme telle**, avec l'adresse à lire à
// la main. Un tableau à moitié rempli qui dit lesquelles de ses cases sont
// vides vaut mieux qu'un tableau plein dont on ne sait pas ce qui est mesuré.

const OPTIONS = {
  // Volume mensuel, du patron lui-même (docs/TRANSCRIPTION.md) : dix chantiers
  // par semaine, deux minutes de dictée chacun.
  minutesAudio: Number(process.env.MINUTES_AUDIO || 90),
  chantiers: Number(process.env.CHANTIERS_PAR_MOIS || 43),
  // Jetons par chantier. Mesurés sur les invites réelles du dépôt
  // (extraction-service.ts, assistant-service.ts et les descriptions d'outils),
  // puis arrondis largement vers le haut : mieux vaut annoncer trop cher.
  jetonsEntree: Number(process.env.JETONS_ENTREE || 20_000),
  jetonsSortie: Number(process.env.JETONS_SORTIE || 3_000),
};

// Les pages à lire, et ce qu'on y cherche. `motif` sert uniquement à repérer
// les passages à montrer : les nombres affichés viennent de la page, jamais
// d'ici.
const SOURCES = [
  {
    // `anthropic.com/pricing` répond 403 au mandataire ; la page de
    // documentation porte le même tableau et passe, elle. Ne pas « corriger »
    // cette adresse vers la page commerciale : ce serait rendre le relevé muet.
    nom: "Anthropic (raisonnement)",
    url: "https://docs.claude.com/en/docs/about-claude/pricing",
    motif: /Claude (Opus|Sonnet|Haiku)[^$]{0,40}(\$[\d.]+ \/ MTok\s*){5}/gi,
  },
  {
    nom: "OpenAI (transcription Whisper + raisonnement)",
    url: "https://platform.openai.com/docs/pricing",
    motif: /(whisper|transcri|audio)[^\n]{0,120}?\$\s?[\d.]/gi,
  },
  {
    nom: "Deepgram (transcription)",
    url: "https://deepgram.com/pricing",
    motif: /\$\s?[\d.]+[^\n]{0,80}(min|hour|heure)/gi,
  },
  {
    nom: "Google Speech-to-Text (transcription)",
    url: "https://cloud.google.com/speech-to-text/pricing",
    motif: /\$\s?[\d.]+[^\n]{0,80}(min|hour)/gi,
  },
  {
    nom: "Mistral (français)",
    url: "https://mistral.ai/pricing",
    motif: /\$\s?[\d.]+[^\n]{0,80}(token|M\b|audio|min)/gi,
  },
  {
    nom: "Gladia (français, transcription)",
    url: "https://www.gladia.io/pricing",
    motif: /(\$|€)\s?[\d.]+[^\n]{0,80}(hour|heure|min)/gi,
  },
];

const enTexte = (html) =>
  html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();

async function lire(source) {
  try {
    const reponse = await fetch(source.url, {
      headers: { "user-agent": "Mozilla/5.0 (compatible; Atlas-releve-tarifs/1.0)" },
      signal: AbortSignal.timeout(30_000),
    });
    if (!reponse.ok) {
      return { ...source, echec: `HTTP ${reponse.status}` };
    }
    const texte = enTexte(await reponse.text());
    const extraits = [...new Set([...texte.matchAll(source.motif)].map((m) => m[0].trim()))].slice(0, 12);
    return { ...source, texte, extraits };
  } catch (err) {
    // Distinguer les causes : « page bloquée » et « rendue en JavaScript »
    // n'appellent pas la même suite, et confondre les deux enverrait chercher
    // au mauvais endroit.
    const cause = err?.name === "TimeoutError" ? "délai dépassé (30 s)" : (err?.message ?? String(err));
    return { ...source, echec: cause };
  }
}

console.log("═".repeat(78));
console.log("  TARIFS DES FOURNISSEURS D'IA, LUS À LA SOURCE");
console.log("═".repeat(78));
console.log(`\n  Relevé du ${new Date().toISOString().slice(0, 10)}.`);
console.log("  Les tarifs de ce métier changent plusieurs fois par an : un relevé");
console.log("  d'il y a six mois ne vaut rien. Relancer avant toute décision.\n");

const releves = await Promise.all(SOURCES.map(lire));

let lisibles = 0;
let muettes = 0;
for (const r of releves) {
  console.log("─".repeat(78));
  console.log(`  ${r.nom}`);
  console.log(`  ${r.url}`);
  if (r.echec) {
    console.log(`  ⛔ Injoignable depuis cette machine : ${r.echec}`);
    console.log("     → à lire à la main, à l'adresse ci-dessus.");
    muettes++;
  } else if (r.extraits.length === 0) {
    // Le cas le plus fréquent, et le plus trompeur : la page répond 200 mais
    // ses tarifs sont posés par du JavaScript. Le dire, plutôt que de laisser
    // croire à une page sans tarif.
    console.log("  ⚠️  Page reçue, aucun tarif reconnu dedans.");
    console.log("     Probablement affichée par du JavaScript (le relevé lit le HTML brut).");
    console.log("     → à lire à la main, à l'adresse ci-dessus.");
    muettes++;
  } else {
    console.log("  ✅ Passages contenant un tarif :\n");
    for (const e of r.extraits) console.log(`       ${e}`);
    lisibles++;
  }
  console.log("");
}

console.log("═".repeat(78));
console.log("  CE QUE ÇA FERAIT PAR MOIS, AU VOLUME DU PATRON");
console.log("═".repeat(78));
console.log(`
  Volume retenu : ${OPTIONS.chantiers} chantiers/mois, ${OPTIONS.minutesAudio} minutes d'audio,
  ${OPTIONS.jetonsEntree.toLocaleString("fr-FR")} jetons en entrée et ${OPTIONS.jetonsSortie.toLocaleString("fr-FR")} en sortie par chantier.

  Pour convertir un tarif relevé ci-dessus en facture mensuelle :

    raisonnement = (${(OPTIONS.chantiers * OPTIONS.jetonsEntree) / 1e6} × prix_entrée_par_million)
                 + (${(OPTIONS.chantiers * OPTIONS.jetonsSortie) / 1e6} × prix_sortie_par_million)

    transcription = ${OPTIONS.minutesAudio} × prix_par_minute
`);

if (muettes > 0) {
  console.log(`  ⚠️  ${muettes} source(s) sur ${releves.length} n'ont rien donné : le tableau est incomplet,`);
  console.log("      et aucun chiffre n'a été supposé à leur place.\n");
}

// Sortir en échec si RIEN n'a été lu : un relevé qui ne relève rien ne doit pas
// passer pour un succès dans l'onglet des exécutions.
if (lisibles === 0) {
  console.error("❌ Aucune source lisible. Le relevé n'apporte rien — ne pas s'en servir pour décider.");
  process.exit(1);
}
console.log(`✅ Relevé terminé : ${lisibles}/${releves.length} source(s) lisible(s).`);
