import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { ligneEtatDeLaBase, retardDeLaBase } from "../src/lib/retard-de-la-base";

/**
 * **SA PANNE DU 13 SEPTEMBRE 2026 :** *« Plus rien ne fonctionne ! »*
 *
 * « Planning » et « Terminés » tombés ensemble, « Chantiers » debout. Sa base
 * s'était arrêtée à la migration 0087 sous le code de `main`, et le serveur
 * répondait `column "conditions_generales" does not exist` (0090). Rien, ni à
 * l'écran ni sur la fiche de son espace, ne portait cet écart : il se
 * découvrait par un écran mort et un numéro de six chiffres.
 *
 * Ce que cette suite tient :
 *
 *   1. **la règle sait dire le retard, dans les deux sens** — et refuse de
 *      rendre un vert quand elle n'a rien pu mesurer ;
 *   2. **le constat est ATTEIGNABLE** : monté dans la fiche de l'espace ET dans
 *      l'écran des Réglages. C'est la leçon du 28 août 2026 — six gestes
 *      écrits, éprouvés, et qu'aucun écran n'importait ;
 *   3. **le geste rendu n'efface RIEN** (`CLAUDE.md` §4 septies, qu'il a dû
 *      poser deux fois). `test-verdict-port.ts` tient la même promesse pour le
 *      verdict du port ; celui de la base n'était couvert par personne.
 */

const RACINE = path.join(__dirname, "..");

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

console.log("=== Ce que la base porte, face à ce que le code attend ===");

cas("SA PANNE : trois migrations appliquées en moins, nommées une par une", () => {
  const toutes = ["0087_a.sql", "0088_b.sql", "0089_c.sql", "0090_d.sql"];
  const retard = retardDeLaBase({ attendues: toutes, appliquees: ["0087_a.sql"] });
  assert.deepEqual(retard.manquantes, ["0088_b.sql", "0089_c.sql", "0090_d.sql"]);
  assert.equal(retard.accordee, false);
  // Le NUMÉRO, pas le compte : c'est lui qui dit quelle colonne manque, donc
  // quel écran tombe. « EN RETARD DE 3 » aurait encore demandé d'aller chercher.
  assert.equal(ligneEtatDeLaBase(retard), "EN RETARD DE 3 — 0088, 0089, 0090");
});

cas("rien à dire quand les deux s'accordent", () => {
  const toutes = ["0001_a.sql", "0002_b.sql"];
  const retard = retardDeLaBase({ attendues: toutes, appliquees: [...toutes] });
  assert.equal(retard.accordee, true);
  assert.equal(ligneEtatDeLaBase(retard), "à jour");
});

cas("l'ordre des lignes de la table ne change rien au verdict", () => {
  // La table `_migrations` n'a pas d'ordre garanti : un verdict qui en
  // dépendrait serait juste un jour sur deux.
  const toutes = ["0001_a.sql", "0002_b.sql", "0003_c.sql"];
  const retard = retardDeLaBase({ attendues: toutes, appliquees: ["0003_c.sql", "0001_a.sql", "0002_b.sql"] });
  assert.equal(retard.accordee, true);
});

cas("une base EN AVANCE se dit aussi — c'est le code qui est en retard", () => {
  // Il redescend d'une version, ou une migration part puis revient. Rendre
  // « à jour » ici mentirait à l'endroit précis où le schéma et le code
  // divergent le plus dangereusement.
  const retard = retardDeLaBase({ attendues: ["0001_a.sql"], appliquees: ["0001_a.sql", "0002_b.sql"] });
  assert.deepEqual(retard.enTrop, ["0002_b.sql"]);
  assert.equal(retard.accordee, false);
  assert.match(ligneEtatDeLaBase(retard), /^le CODE est en retard sur elle de 1 — 0002$/);
});

cas("les deux écarts à la fois se disent tous les deux", () => {
  const retard = retardDeLaBase({ attendues: ["0001_a.sql", "0002_b.sql"], appliquees: ["0001_a.sql", "0009_z.sql"] });
  const ligne = ligneEtatDeLaBase(retard);
  assert.match(ligne, /EN RETARD DE 1 — 0002/);
  assert.match(ligne, /le CODE est en retard sur elle de 1 — 0009/);
});

cas("une mesure IMPOSSIBLE ne rend jamais un vert", () => {
  // Base injoignable, dossier absent : l'absence de matière à mesurer n'est pas
  // un succès (`CLAUDE.md` §5, le contrôle qui mesurait zéro).
  assert.equal(ligneEtatDeLaBase(null), "état inconnu — la base n'a pas répondu");
});

console.log("\n=== …et le constat est ATTEIGNABLE, pas seulement écrit ===");

cas("la fiche de son espace porte une ligne « Base »", () => {
  const source = readFileSync(path.join(RACINE, "scripts", "diagnostiquer-espace.mjs"), "utf8");
  assert.match(source, /Base {13}: \$\{base\}/, "la fiche ne publie pas l'état de la base");
  assert.match(
    source,
    /scripts\/etat-de-la-base\.ts/,
    "la fiche ne passe plus par le script commun : un second calcul finirait par contredire l'écran"
  );
});

cas("l'écran des Réglages le lit vraiment, et par le même chemin", () => {
  const source = readFileSync(path.join(RACINE, "src", "app", "reglages", "page.tsx"), "utf8");
  assert.match(source, /etatDeLaBase/, "l'écran où il demande « est-ce que j'ai les corrections ? » ne sait rien de sa base");
  assert.match(source, /base && !base\.accordee/, "l'écran ne rend rien quand la base a pris du retard");
});

cas("et le script commun emploie la règle, il n'en écrit pas une seconde", () => {
  const source = readFileSync(path.join(RACINE, "scripts", "etat-de-la-base.ts"), "utf8");
  assert.match(source, /ligneEtatDeLaBase/);
  assert.match(source, /retard-de-la-base/);
});

console.log("\n=== Et le geste rendu n'efface RIEN ===");

cas("aucun geste de la fiche ni de l'écran ne peut effacer ses données", () => {
  // **Il a dû l'interdire DEUX fois** (`CLAUDE.md` §4 septies) : « reconstruis
  // le conteneur » le 13 septembre, « repars sur un disque sain » le 10 août.
  // `test-verdict-port.ts` tient cette promesse pour le verdict du port ; celui
  // de la base n'était couvert par personne.
  const interdits = [
    /rebuild\s*container/i,
    /reconstrui/i,
    /db:seed/i,
    /\bseed\b/i,
    /db:push/i,
    /TRUNCATE/i,
    /\bDROP\b/,
    /supprime[rz]?\s+(ton|votre|l')\s*espace/i,
  ];
  for (const fichier of [
    path.join(RACINE, "scripts", "diagnostiquer-espace.mjs"),
    path.join(RACINE, "src", "app", "reglages", "page.tsx"),
  ]) {
    // Seul ce que le patron LIT est jugé : les commentaires du code expliquent
    // parfois ce qui est interdit, et les juger reviendrait à interdire d'en
    // parler — c'est ainsi qu'un garde-fou s'apprend à être contourné.
    const rendues = readFileSync(fichier, "utf8")
      .split("\n")
      .filter((l) => /soucis\.push|console\.log|<p |base\.manquantes|Touchez/.test(l))
      .filter((l) => !/^\s*(\/\/|\*|\/\*|#)/.test(l.trim()));
    for (const ligne of rendues) {
      for (const interdit of interdits) {
        assert.ok(
          !interdit.test(ligne),
          `${path.basename(fichier)} propose un geste qui peut effacer ses données : ${ligne.trim()}`
        );
      }
    }
  }
});

cas("le geste proposé est celui qui répare sans rien détruire", () => {
  const source = readFileSync(path.join(RACINE, "scripts", "diagnostiquer-espace.mjs"), "utf8");
  assert.match(
    source,
    /Chercher les dernières corrections/,
    "la fiche constate le retard sans dire quoi faire : un diagnostic muet le laisse devant un écran mort"
  );
});

console.log("\n=== La réparation ne dépend plus d'un écran ===");

// **SA CAPTURE DU 13 SEPTEMBRE 2026, AU SOIR.** Le rattrapage était en place —
// à chaque allumage, et sur le bouton « Chercher les dernières corrections ».
// Les deux passaient par un geste de sa part, et le bouton vit dans l'écran des
// Réglages… qui tombait pour la même raison que les autres : il lisait
// l'entreprise ENTIÈRE pour en afficher le nom. Il a donc lu « Tarifs
// indisponibles » en allant chercher le remède. **La porte de secours se
// fermait avec la maison.**

cas("le veilleur rattrape la base tout seul, sans écran ni bouton", () => {
  const source = readFileSync(path.join(RACINE, ".devcontainer", "veiller.sh"), "utf8");
  assert.match(
    source,
    /rattraper_la_base\(\)\s*\{/,
    "le veilleur ne sait plus rattraper la base : la réparation redevient un geste, " +
      "et ce geste vit derrière un écran qui peut être tombé"
  );
  // Déclarée ne suffit pas : c'est d'être APPELÉE dans la boucle qui la rend
  // vivante (la leçon du 28 août — six gestes écrits, aucun atteignable).
  const appels = source.split("\n").filter((l) => /^\s*rattraper_la_base\s*$/.test(l));
  assert.ok(appels.length > 0, "la fonction existe mais rien ne l'appelle : elle ne servira jamais");
  assert.match(source, /appliquer-migrations\.sh/, "le veilleur n'emploie pas le script commun");
});

cas("l'écran de dépannage ne lit plus l'entreprise entière", () => {
  const source = readFileSync(path.join(RACINE, "src", "app", "reglages", "page.tsx"), "utf8");
  const lignes = source.split("\n").filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l.trim()));
  assert.ok(
    !lignes.some((l) => /getEntreprise/.test(l)),
    "Réglages relit toutes les colonnes de l'entreprise : il retombera dès qu'une " +
      "migration manquera, c'est-à-dire précisément quand il vient y chercher le bouton"
  );
  assert.ok(
    lignes.some((l) => /nomDeLEntreprise/.test(l)),
    "Réglages n'affiche plus le nom de l'entreprise : la feuille de déconnexion ne dit plus d'où l'on sort"
  );
});

cas("…et cette lecture-là ne demande qu'une colonne", () => {
  const source = readFileSync(path.join(RACINE, "src", "server", "repositories", "entreprises.ts"), "utf8");
  const debut = source.indexOf("export async function nomDeLEntreprise");
  assert.notEqual(debut, -1, "la lecture d'une seule colonne a disparu");
  const corps = source.slice(debut, debut + 600);
  assert.match(
    corps,
    /\.select\(\{\s*nom:/,
    "elle ne projette plus : une colonne ajoutée ailleurs refermerait la porte de secours"
  );
});

console.log(`\n${echecs === 0 ? "✅" : "❌"} Le retard de la base — ${echecs} échec(s).`);
if (echecs > 0) process.exit(1);
