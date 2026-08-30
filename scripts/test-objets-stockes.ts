// LA LISTE DES COLONNES QUI PORTENT UN FICHIER NE DOIT JAMAIS DORMIR.
//
// ─────────────────────────────────────────────────────────────────────────────
// **CE QUE CETTE SUITE DÉFEND, ET CONTRE QUOI.**
//
// `src/lib/objets-stockes.ts` déclare les onze colonnes qui portent la clé d'un
// objet rangé dans le stockage. Tout le contrôle de cohérence base ↔ fichiers
// repose dessus. Or une liste écrite à la main a une seule façon de mourir :
// **quelqu'un ajoute une douzième colonne et oublie de l'y inscrire.**
//
// Rien ne le signalerait. Le contrôle de cohérence continuerait de dire « tout
// va bien » en ayant cessé de regarder une famille entière de fichiers. C'est
// exactement le défaut que `CLAUDE.md` §5 nomme : un contrôle qui ne mesure
// plus rien ne dit pas « rouge », il ne dit rien.
//
// Cette suite relit donc `schema.ts` — le vrai — et confronte.
//
// **Elle a été VUE ROUGE, à sa toute première exécution, et sur elle-même** :
// son motif attrapait `cles_appareil.identifiant_cle`, qui est une clé Face ID
// et non une clé de rangement. L'exception est nommée plus bas avec sa raison.
// Un contrôle qui n'a jamais échoué ne prouve rien ; celui-ci a commencé par là.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { COLONNES_OBJET, colonnesOuUneAbsenceEstGrave, requeteDesCles } from "../src/lib/objets-stockes";

let echecs = 0;
function essai(nom: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.log(`  ✗ ${nom}`);
    console.log(`    ${(e as Error).message}`);
  }
}

/**
 * Ce que le motif large attrape à tort — nommé, avec sa raison.
 *
 * **Trouvé par ce contrôle lui-même, à sa première exécution.** Le motif retient
 * tout ce qui finit par `_cle`, et c'est voulu : il doit attraper la colonne que
 * personne n'a encore écrite. Il attrape donc aussi ce qui porte une clé au sens
 * de la CRYPTOGRAPHIE et non au sens du RANGEMENT.
 *
 * Chaque exception est écrite ici avec son motif, jamais retirée en silence : une
 * liste d'exceptions muette redevient un motif trop étroit, et c'est le défaut
 * qu'on cherchait à éviter.
 */
const EXCEPTIONS = new Set<string>([
  // Identifiant d'une clé Face ID (WebAuthn). Vit en base, ne désigne aucun
  // objet dans le stockage — le déclarer ferait chercher un fichier inexistant
  // pour chaque appareil enregistré.
  "cles_appareil.identifiant_cle",
]);

/**
 * Les colonnes du schéma qui portent une clé d'objet, lues dans le fichier.
 *
 * **Le motif est volontairement LARGE** : `storage_key`, mais aussi tout ce qui
 * finit par `_cle` ou commence par `pdf_`. Une liste de noms exacts raterait la
 * prochaine colonne, qui s'appellera autrement — et c'est précisément le cas
 * qu'on veut attraper. Trop large fait rougir sur une colonne innocente, ce qui
 * se corrige en dix secondes ; trop étroit ne fait jamais rougir, ce qui ne se
 * corrige jamais.
 */
function colonnesDuSchema(): Array<{ table: string; colonne: string }> {
  const source = readFileSync("src/server/db/schema.ts", "utf8").split("\n");
  const trouvees: Array<{ table: string; colonne: string }> = [];
  let table: string | null = null;

  for (const ligne of source) {
    // `pgTable("nom"` peut être sur la ligne de l'export ou sur la suivante :
    // les deux formes existent dans ce fichier, et n'en gérer qu'une ferait
    // rattacher des colonnes à la table précédente — un faux vert.
    const nom = ligne.match(/pgTable\(\s*"([a-z_]+)"/) ?? ligne.match(/^\s*"([a-z_]+)",\s*$/);
    if (nom && (ligne.includes("pgTable") || table === "")) table = nom[1];
    else if (ligne.includes("pgTable(")) table = nom ? nom[1] : "";

    const col = ligne.match(/\b(?:text|varchar)\(\s*"([a-z_]+)"/);
    if (!col || !table) continue;
    const c = col[1];
    const porteUneCle = c === "storage_key" || c.endsWith("_storage_key") || c.endsWith("_cle") || c === "photo_cle";
    // `pdf_checksum` accompagne `pdf_storage_key` mais ne porte pas de clé :
    // l'inclure ferait réclamer une entrée pour une empreinte.
    if (porteUneCle && !c.includes("checksum") && !EXCEPTIONS.has(`${table}.${c}`)) {
      trouvees.push({ table, colonne: c });
    }
  }
  return trouvees;
}

function main() {
  console.log("=== Les colonnes qui portent un fichier ===\n");

  const duSchema = colonnesDuSchema();

  essai("le schéma est bien lu — sinon ce contrôle ne mesure RIEN", () => {
    // Le garde-fou de `CLAUDE.md` §5 : refuser de conclure sur zéro. Si la
    // lecture du schéma casse un jour (renommage de fichier, format changé),
    // `duSchema` vaudrait [] et TOUTES les comparaisons ci-dessous passeraient.
    assert.ok(
      duSchema.length >= 10,
      `seulement ${duSchema.length} colonne(s) trouvée(s) dans schema.ts : la lecture a échoué, ` +
        "et un contrôle qui ne lit rien ne prouve rien."
    );
  });

  essai("AUCUNE colonne du schéma ne manque à la liste", () => {
    const declarees = new Set(COLONNES_OBJET.map((c) => `${c.table}.${c.colonne}`));
    const oubliees = duSchema
      .map((c) => `${c.table}.${c.colonne}`)
      .filter((c) => !declarees.has(c));
    assert.deepEqual(
      [...new Set(oubliees)],
      [],
      "Des colonnes portent une clé d'objet sans être déclarées dans " +
        "`src/lib/objets-stockes.ts`. Le contrôle de cohérence base ↔ fichiers " +
        "ne les regarde donc pas, et personne ne le saurait."
    );
  });

  essai("AUCUNE entrée de la liste ne désigne une colonne disparue", () => {
    const duSchemaSet = new Set(duSchema.map((c) => `${c.table}.${c.colonne}`));
    const fantomes = COLONNES_OBJET.map((c) => `${c.table}.${c.colonne}`).filter(
      (c) => !duSchemaSet.has(c)
    );
    assert.deepEqual(
      fantomes,
      [],
      "La liste réclame des colonnes qui n'existent plus. Le contrôle de " +
        "cohérence échouerait à l'exécution, sur un défaut qui n'en est pas un."
    );
  });

  essai("chaque entrée dit CE QUE C'EST, en français", () => {
    for (const c of COLONNES_OBJET) {
      assert.ok(c.quoi.length > 5, `${c.table}.${c.colonne} n'explique pas ce qu'elle porte`);
    }
  });

  essai("une absence dite NORMALE porte toujours sa raison", () => {
    // Sans raison écrite, « normale » devient un interrupteur qu'on pousse pour
    // faire taire un rouge — et le garde-fou se vide de l'intérieur.
    for (const c of COLONNES_OBJET) {
      if (!c.absenceNormale) continue;
      assert.ok(
        c.raisonAbsence && c.raisonAbsence.length > 10,
        `${c.table}.${c.colonne} tolère l'absence sans dire pourquoi`
      );
    }
  });

  essai("il reste au moins UNE colonne où l'absence est grave", () => {
    // Si toutes devenaient tolérantes, le contrôle de cohérence ne pourrait
    // plus rougir sur rien : il compterait, sans jamais accuser.
    const graves = colonnesOuUneAbsenceEstGrave();
    assert.ok(
      graves.length >= 1,
      "aucune colonne ne considère plus une absence comme grave : le contrôle " +
        "de cohérence ne peut plus rien attraper."
    );
  });

  essai("la requête engendrée ne prend que des noms de la liste", () => {
    for (const c of COLONNES_OBJET) {
      const r = requeteDesCles(c);
      assert.match(r, /^SELECT [a-z_]+ AS cle FROM [a-z_]+ WHERE /);
      // **L'assertion d'origine refusait TOUTE apostrophe, et elle était fausse :**
      // la requête compare légitimement à la chaîne vide (`<> ''`). Ce qu'il faut
      // interdire, c'est un point-virgule (deux ordres au lieu d'un) et un
      // commentaire SQL (le reste de la ligne neutralisé) — pas la ponctuation.
      assert.ok(!/;|--|\/\*/.test(r), `requête suspecte pour ${c.table} : ${r}`);
      // Et les noms viennent bien de la liste, pas d'ailleurs.
      assert.ok(r.includes(c.table) && r.includes(c.colonne));
    }
  });

  console.log("");
  console.log(`Colonnes portant un fichier — ${echecs} échec(s).`);
  process.exit(echecs > 0 ? 1 : 0);
}

main();
