/**
 * Aller chercher les documents phytosanitaires **là où on peut y accéder**.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * **Pourquoi ce script ne tourne pas dans l'environnement de développement.**
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Le 20 août 2026, le patron demande de constituer les premières fiches. Elles
 * doivent venir de sources officielles — DSF, INRAE, FREDON, ONF, BSV — et sa
 * règle est absolue : *« tu ne dois inventer aucune fiche phytosanitaire »*.
 *
 * **Aucun de ces domaines n'est joignable depuis l'environnement de
 * développement.** Le mandataire répond `403 à CONNECT — policy denial` sur
 * `agriculture.gouv.fr`, `inrae.fr`, `fredon-france.org`, `onf.fr`,
 * `plante-et-cite.fr` et `ephy.anses.fr`. La recherche web, elle, passe — mais
 * elle rend un RÉSUMÉ écrit par un modèle, pas la page. Écrire une fiche
 * « validée » d'après un résumé, c'est blanchir une paraphrase en donnée
 * sourcée : exactement ce que la règle interdit, avec l'apparence du sérieux
 * en plus.
 *
 * **La règle du dépôt pour ce cas est écrite** (`CLAUDE.md` §5) : ce qui ne
 * peut pas être éprouvé ici doit l'être ailleurs, et l'on déplace la
 * vérification plutôt que de la contourner. `pages.yml` interroge le site à son
 * adresse publique, `relever-palette.yml` va lire les modèles chez leur hôte,
 * `banc-essai.yml` monte l'espace complet. Ce script est le quatrième de cette
 * famille.
 *
 * ── Ce qu'il fait, et ce qu'il ne fait pas ─────────────────────────────────
 *
 * Il télécharge les documents déclarés dans `donnees/phyto/sources.json` et
 * dépose leur TEXTE dans `donnees/phyto/sources/`, avec un en-tête de
 * provenance. **Il n'écrit aucune fiche** : lire et comprendre reste un travail
 * humain, fait ensuite, sur des textes qu'on a réellement sous les yeux.
 *
 * **Rien n'est rapatrié sans licence déclarée.** Une source en `a_verifier`
 * garde son adresse et rien d'autre. Recopier un document sans savoir s'il peut
 * l'être est un risque qui ne se voit qu'à la mise en demeure.
 *
 * Usage : node scripts/recolter-sources-phyto.mjs [--dry]
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const RACINE = "donnees/phyto";
const DESTINATION = path.join(RACINE, "sources");
const CATALOGUE = path.join(RACINE, "sources.json");
const sec = (n) => n * 1000;

const aBlanc = process.argv.includes("--dry");

const catalogue = JSON.parse(readFileSync(CATALOGUE, "utf-8"));
const sources = catalogue.sources ?? [];
if (sources.length === 0) {
  console.error(`❌ ${CATALOGUE} ne déclare aucune source.`);
  process.exit(1);
}

mkdirSync(DESTINATION, { recursive: true });

const journal = [];
let echecs = 0;
let ecrits = 0;
let ecartes = 0;

for (const source of sources) {
  const manquant = ["code", "organisme", "titre", "url", "nature", "licence"].filter((c) => !source[c]);
  if (manquant.length > 0) {
    // Le message désigne le bon coupable : c'est le catalogue qui est
    // incomplet, pas le réseau.
    console.error(`❌ ${source.code ?? "(sans code)"} — champs manquants dans sources.json : ${manquant.join(", ")}`);
    echecs++;
    continue;
  }

  if (source.licence === "a_verifier") {
    console.log(`  ⏭  ${source.code} — licence non établie, texte NON rapatrié (${source.url})`);
    journal.push({ code: source.code, statut: "ecarte_licence", url: source.url });
    ecartes++;
    continue;
  }

  if (aBlanc) {
    console.log(`  · ${source.code} — serait récolté depuis ${source.url}`);
    continue;
  }

  try {
    const debut = Date.now();
    const reponse = await fetch(source.url, {
      redirect: "follow",
      signal: AbortSignal.timeout(sec(60)),
      headers: { "User-Agent": "Atlas-app/recolte-phyto (contact via le dépôt GitHub)" },
    });

    if (!reponse.ok) {
      console.error(`❌ ${source.code} — HTTP ${reponse.status} sur ${source.url}`);
      journal.push({ code: source.code, statut: `http_${reponse.status}`, url: source.url });
      echecs++;
      continue;
    }

    const type = (reponse.headers.get("content-type") ?? "").toLowerCase();
    const octets = Buffer.from(await reponse.arrayBuffer());
    const texte = type.includes("pdf") || source.url.endsWith(".pdf")
      ? await texteDuPdf(octets, source.code)
      : texteDuHtml(octets.toString("utf-8"));

    // **Un document vide n'est pas un document récolté.** C'est la règle du
    // 15 août : une mesure de zéro ne mesure rien, et un fichier vide déposé
    // ici laisserait croire que la source a été lue.
    if (texte.trim().length < 200) {
      console.error(
        `❌ ${source.code} — ${texte.trim().length} caractères extraits : trop peu pour être le document. ` +
          `Le format a peut-être changé, ou la page exige un navigateur.`
      );
      journal.push({ code: source.code, statut: "extraction_vide", url: source.url });
      echecs++;
      continue;
    }

    const enTete = [
      "# Document récolté automatiquement — NE PAS MODIFIER À LA MAIN",
      "#",
      `# code        : ${source.code}`,
      `# organisme   : ${source.organisme}`,
      `# titre       : ${source.titre}`,
      `# url         : ${source.url}`,
      `# nature      : ${source.nature}`,
      `# licence     : ${source.licence}`,
      `# consulté le : ${new Date().toISOString().slice(0, 10)}`,
      "#",
      "# Le texte ci-dessous est celui du document d'origine. Les fiches se",
      "# saisissent À PARTIR de lui, jamais de mémoire — et chaque champ qui",
      "# engage doit citer ce code de source dans donnees/phyto/*.json.",
      "",
      "",
    ].join("\n");

    writeFileSync(path.join(DESTINATION, `${source.code}.txt`), enTete + texte, "utf-8");
    console.log(`  ✓ ${source.code} — ${texte.length} caractères (${Date.now() - debut} ms)`);
    journal.push({ code: source.code, statut: "recolte", url: source.url, caracteres: texte.length });
    ecrits++;
  } catch (err) {
    console.error(`❌ ${source.code} — ${err instanceof Error ? err.message : err}`);
    journal.push({ code: source.code, statut: "erreur", url: source.url });
    echecs++;
  }
}

if (!aBlanc) {
  writeFileSync(
    path.join(DESTINATION, "_journal.json"),
    JSON.stringify({ recolteLe: new Date().toISOString(), journal }, null, 2),
    "utf-8"
  );
}

console.log(
  `\n${ecrits} document(s) récolté(s), ${ecartes} écarté(s) faute de licence, ${echecs} en échec.`
);
// **Un échec ne fait pas tomber la récolte entière** : une adresse morte parmi
// vingt ne doit pas priver des dix-neuf autres. Le journal dit lesquelles, et
// c'est ce qu'on lit ensuite.
process.exit(echecs > 0 && ecrits === 0 ? 1 : 0);

/**
 * Le texte d'une page HTML — sans balise, sans script, sans style.
 *
 * Volontairement rudimentaire : on ne cherche pas à reproduire la mise en page,
 * seulement à pouvoir LIRE le document. Une extraction élégante demanderait une
 * dépendance de plus pour un gain nul.
 */
function texteDuHtml(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<\/(p|div|li|tr|h[1-6])>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Le texte d'un PDF, par `pdftotext`.
 *
 * **L'outil est installé par le workflow, pas supposé présent.** Son absence
 * doit se dire clairement plutôt que de produire un fichier vide qu'on prendrait
 * pour un document illisible — le message doit désigner le bon coupable.
 */
async function texteDuPdf(octets, code) {
  const { spawnSync } = await import("node:child_process");
  const { tmpdir } = await import("node:os");
  const provisoire = path.join(tmpdir(), `phyto-${code}.pdf`);
  writeFileSync(provisoire, octets);

  const r = spawnSync("pdftotext", ["-layout", "-enc", "UTF-8", provisoire, "-"], {
    encoding: "utf-8",
    maxBuffer: 64 * 1024 * 1024,
  });

  if (r.error && r.error.code === "ENOENT") {
    throw new Error(
      "pdftotext est absent de cette machine. Le workflow l'installe (poppler-utils) ; " +
        "en local, `apt-get install poppler-utils`."
    );
  }
  if (r.status !== 0) {
    throw new Error(`pdftotext a échoué (code ${r.status}) : ${(r.stderr || "").slice(0, 200)}`);
  }
  return r.stdout;
}
