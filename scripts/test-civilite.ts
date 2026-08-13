import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { Pool } from "pg";
import { avecCivilite, porteDejaSonAppellation, CIVILITE_PAR_DEFAUT } from "../src/lib/civilite";

// **Comment on nomme un client sur un document qui part chez lui.**
//
// ─────────────────────────────────────────────────────────────────────────────
// Le patron, le 13 août 2026, capture de son devis à l'appui : *« il faut qu'il
// y ait écrit monsieur Martins et pas chez Martins »*.
//
// Ce qui est tenu ici n'est pas l'orthographe du mot « Monsieur », c'est ce que
// la civilité ne doit JAMAIS produire : « Monsieur Mme Roux », « Monsieur SARL
// Untel », ou un « Monsieur » posé deux fois sur un nom déjà stocké.
//
// **Et le dernier cas est le plus important de tous.** La même règle existe
// deux fois — en TypeScript ici, en SQL dans `drizzle/0036_…` — parce que le
// lanceur de migrations ne sait exécuter que du SQL. `CLAUDE.md` §3 interdit de
// dupliquer une règle, précisément parce que deux copies divergent : faute de
// pouvoir n'en garder qu'une, ce contrôle les **confronte l'une à l'autre** sur
// le même corpus de noms. Le jour où quelqu'un complète une liste sans toucher
// l'autre, il vire au rouge.

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

async function casAsync(nom: string, verifier: () => Promise<void>) {
  try {
    await verifier();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.error(`  ✗ ${nom}\n    ${(e as Error).message}`);
  }
}

/**
 * Le corpus, partagé par les deux implémentations.
 *
 * `civilite` dit ce que la fonction doit rendre ; `déjàNommé` dit si le nom
 * porte déjà son appellation — c'est cette seconde colonne que le SQL de la
 * migration doit retrouver, mot pour mot.
 */
const nomme = (n: string) => `${CIVILITE_PAR_DEFAUT} ${n}`;

const CORPUS: { saisi: string; attendu: string }[] = [
  // Le cas du patron, celui de la capture.
  { saisi: "Martins", attendu: nomme("Martins") },
  { saisi: "Bernard", attendu: nomme("Bernard") },
  { saisi: "Rivière", attendu: nomme("Rivière") },
  { saisi: "Jean-Marie Dubois", attendu: nomme("Jean-Marie Dubois") },
  // **« Merlin » commence par un m, et n'est pas un « M. ».** C'est le piège
  // qu'une comparaison de préfixe sans séparateur laisse passer.
  { saisi: "Merlin", attendu: nomme("Merlin") },
  { saisi: "Mathieu Dubois", attendu: nomme("Mathieu Dubois") },
  { saisi: "Meunier", attendu: nomme("Meunier") },
  // Civilités déjà écrites : on n'en pose pas une seconde.
  { saisi: "M. Bernard", attendu: "M. Bernard" },
  { saisi: "Mme Roux", attendu: "Mme Roux" },
  { saisi: "Madame Roux", attendu: "Madame Roux" },
  { saisi: "Monsieur Martins", attendu: "Monsieur Martins" },
  { saisi: "Mr. Martins", attendu: "Mr. Martins" },
  { saisi: "Mlle Petit", attendu: "Mlle Petit" },
  { saisi: "Dr Lemoine", attendu: "Dr Lemoine" },
  { saisi: "Me Fabre", attendu: "Me Fabre" },
  { saisi: "MME ROUX", attendu: "MME ROUX" },
  // Sociétés : on ne dit pas « Monsieur » à une raison sociale.
  { saisi: "SARL Untel", attendu: "SARL Untel" },
  { saisi: "Untel SARL", attendu: "Untel SARL" },
  { saisi: "SCI des Tilleuls", attendu: "SCI des Tilleuls" },
  { saisi: "Mairie de Nantes", attendu: "Mairie de Nantes" },
  { saisi: "Cabinet Léger", attendu: "Cabinet Léger" },
  { saisi: "Copropriété Les Chênes", attendu: "Copropriété Les Chênes" },
];

console.log("=== La civilité : ce qu'elle pose, et ce qu'elle ne pose jamais ===");

for (const { saisi, attendu } of CORPUS) {
  cas(`« ${saisi} » → « ${attendu} »`, () => {
    assert.equal(avecCivilite(saisi), attendu);
  });
}

console.log("\n=== Ce qu'elle ne fait jamais ===");

cas("appliquée deux fois, elle rend la même chose", () => {
  // Cette propriété n'est pas un agrément : la migration pose la civilité sur
  // des noms DÉJÀ EN BASE, et une reprise de migration ne doit pas produire
  // « Monsieur Monsieur Martins ».
  for (const { saisi } of CORPUS) {
    const une = avecCivilite(saisi);
    assert.equal(avecCivilite(une), une, `« ${saisi} » n'est pas stable`);
  }
});

cas("rien n'est fabriqué à partir de rien", () => {
  // Un nom absent ne devient pas « Monsieur » tout court : ce serait une
  // donnée inventée (`CLAUDE.md` §4), et un devis adressé à personne.
  assert.equal(avecCivilite(null), "");
  assert.equal(avecCivilite(undefined), "");
  assert.equal(avecCivilite(""), "");
  assert.equal(avecCivilite("   "), "");
});

cas("le nom saisi survit intact — accents, casse, traits d'union", () => {
  for (const { saisi } of CORPUS) {
    assert.ok(
      avecCivilite(saisi).endsWith(saisi.trim()),
      `« ${saisi} » a été altéré : « ${avecCivilite(saisi)} »`
    );
  }
});

cas("un seul mot posé, et c'est celui qu'on croit", () => {
  const ajout = avecCivilite("Martins").replace("Martins", "").trim();
  assert.equal(ajout, CIVILITE_PAR_DEFAUT);
});

cas("et ce mot est CELUI QU'IL A DEMANDÉ", () => {
  // **Le seul endroit où le mot est écrit en clair, et c'est voulu.** Partout
  // ailleurs les attentes se construisent à partir de la constante, pour qu'un
  // changement de sa part n'ait pas à traverser dix suites. Mais si personne ne
  // l'épingle une fois, la constante peut valoir n'importe quoi et tout reste
  // vert. Le patron, le 13 août 2026 : *« Mr. Martins, pas Monsieur. »*
  assert.equal(CIVILITE_PAR_DEFAUT, "Mr.");
  assert.equal(avecCivilite("Martins"), "Mr. Martins");
});

// ─── La migration et la fonction disent la même chose ────────────────────────

/**
 * Rejoue les deux conditions de `drizzle/0036_…` — civilité connue, marqueur de
 * société — sur un nom donné, dans PostgreSQL.
 *
 * **Le prédicat n'est pas recopié ici : il est EXTRAIT du fichier de
 * migration.** Recopié, il aurait divergé du jour où quelqu'un corrige la
 * migration — c'est-à-dire que le contrôle serait passé au vert sur une règle
 * qui n'existe plus nulle part.
 */
function predicatDeLaMigration(): string {
  const sql = readFileSync(path.join(__dirname, "..", "drizzle", "0036_monsieur_plutot_que_chez.sql"), "utf-8");
  // Les deux repères sont posés dans la migration EXPRÈS pour cette extraction.
  // Chercher un morceau de code (« AND lower(split_part( ») marchait tant que
  // le SQL ne bougeait pas ; il a bougé le jour même, et l'extraction a rendu
  // un prédicat tronqué dont l'erreur — « syntax error at or near "AS" » —
  // désignait la requête d'appel au lieu de l'extraction.
  const OUVRE = "-- <predicat-civilite>";
  const FERME = "-- </predicat-civilite>";
  const debut = sql.indexOf(OUVRE);
  const fin = sql.indexOf(FERME);
  assert.ok(
    debut > 0 && fin > debut,
    `les repères ${OUVRE} … ${FERME} sont absents de la migration 0036 : ` +
      "le prédicat a été déplacé ou réécrit sans mettre ce contrôle au courant."
  );
  return sql
    .slice(debut + OUVRE.length, fin)
    // Les lignes de commentaire du repère d'ouverture débordent sur la suite.
    .replace(/^[^\n]*\n/, "\n")
    .replaceAll("cl.nom", "$1");
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL manquant : ce contrôle confronte le SQL de la migration à la fonction.");
    process.exit(1);
  }
  const pool = new Pool({ connectionString: url });

  console.log("\n=== La migration et la fonction disent la même chose ===");

  const predicat = predicatDeLaMigration();

  await casAsync("les deux implémentations s'accordent sur tout le corpus", async () => {
    const desaccords: string[] = [];
    for (const { saisi } of CORPUS) {
      const { rows } = await pool.query(`SELECT (${predicat}) AS a_nommer`, [saisi]);
      // Le SQL répond « ce nom doit RECEVOIR la civilité » ; la fonction répond
      // l'inverse — d'où la négation, écrite plutôt que sous-entendue.
      const sqlPose = rows[0].a_nommer === true;
      const tsPose = !porteDejaSonAppellation(saisi);
      if (sqlPose !== tsPose) {
        desaccords.push(
          `« ${saisi} » : la migration ${sqlPose ? "pose" : "ne pose pas"} la civilité, ` +
            `la fonction ${tsPose ? "la pose" : "ne la pose pas"}`
        );
      }
    }
    assert.deepEqual(
      desaccords,
      [],
      "Les deux copies de la règle ont divergé :\n      " + desaccords.join("\n      ")
    );
  });

  await casAsync("le contrôle sait échouer : un nom absent des deux listes le montrerait", async () => {
    // **Un contrôle jamais vu rouge ne prouve rien** (`AGENTS.md`). On lui
    // donne ici un nom qu'AUCUNE des deux listes ne connaît : les deux doivent
    // dire « pose la civilité », et l'accord doit donc tenir. Puis un nom
    // qu'une seule liste connaîtrait ferait tomber le cas précédent — c'est ce
    // qu'on vérifie en interrogeant le SQL sur une civilité inventée.
    const { rows } = await pool.query(`SELECT (${predicat}) AS a_nommer`, ["Ziegler"]);
    assert.equal(rows[0].a_nommer, true, "le SQL refuse de nommer un patronyme ordinaire");
    const { rows: r2 } = await pool.query(`SELECT (${predicat}) AS a_nommer`, ["Mme Ziegler"]);
    assert.equal(r2[0].a_nommer, false, "le SQL poserait « Monsieur » devant « Mme »");
  });

  // ─── La migration touche VRAIMENT des lignes ───────────────────────────────
  //
  // **Le contrôle le plus important de ce fichier.** La première version de la
  // migration 0036 était un `UPDATE … FROM …` ordinaire : elle s'est appliquée
  // sans erreur, a rapporté un succès, et **n'a changé aucune ligne**.
  // `chantiers` et `clients` portent la RLS en mode FORCÉ, le propriétaire y
  // compris : sans `app.entreprise_id` posé, aucune ligne n'est visible et
  // l'UPDATE passe dans le vide, sans un mot.
  //
  // Un « 1 migration appliquée » ne prouve donc rien. Ce cas rejoue la migration
  // sur des données à lui, et vérifie le RÉSULTAT.

  console.log("\n=== La migration renomme vraiment, malgré la RLS forcée ===");

  await casAsync("« Chez X » devient la civilité, et rien d'autre ne bouge", async () => {
    // **Les DEUX migrations, dans l'ordre.** La 0036 retire « Chez » et pose
    // « Monsieur » ; la 0037 remplace ce mot par celui qu'il a demandé. Jouer
    // la première seule laisserait croire que la base et le code s'accordent
    // alors qu'ils diraient deux mots différents.
    const sql = ["0036_monsieur_plutot_que_chez.sql", "0037_mr_plutot_que_monsieur.sql"]
      .map((f) => readFileSync(path.join(__dirname, "..", "drizzle", f), "utf-8"))
      .join("\n");
    const client = await pool.connect();
    try {
      // Tout se joue dans une transaction annulée : le contrôle ne laisse
      // aucune trace dans la base que les autres suites partagent.
      await client.query("BEGIN");
      const { rows: ent } = await client.query("SELECT id FROM entreprises LIMIT 1");
      assert.ok(ent[0], "aucune entreprise en base : jouer `npm run db:seed` d'abord");
      await client.query("SELECT set_config('app.entreprise_id', $1, true)", [ent[0].id]);

      // **Ce que la base doit contenir, dit par la FONCTION.** Écrire les
      // résultats en dur ici rendrait le contrôle muet le jour où le patron
      // change de civilité : il rougirait sur le mot au lieu de vérifier que
      // les deux implémentations s'accordent, ce qui est son seul sujet.
      const attendu: Record<string, string> = {
        // Le cas du patron.
        "Zzz Martins": avecCivilite("Zzz Martins"),
        // « Chez » disparaît, la civilité déjà là ne double pas.
        "Mme Zzz Roux": avecCivilite("Mme Zzz Roux"),
        // Une société ne reçoit jamais de civilité.
        "SARL Zzz Untel": avecCivilite("SARL Zzz Untel"),
      };
      for (const nomClient of Object.keys(attendu)) {
        const { rows } = await client.query(
          "INSERT INTO clients (entreprise_id, nom) VALUES ($1, $2) RETURNING id",
          [ent[0].id, nomClient]
        );
        await client.query("INSERT INTO chantiers (entreprise_id, client_id, nom) VALUES ($1, $2, $3)", [
          ent[0].id,
          rows[0].id,
          `Chez ${nomClient}`,
        ]);
      }
      // Et un chantier NOMMÉ À LA MAIN, qui ne doit pas être touché : c'est la
      // saisie du patron, elle lui appartient.
      const { rows: cl } = await client.query(
        "INSERT INTO clients (entreprise_id, nom) VALUES ($1, $2) RETURNING id",
        [ent[0].id, "Zzz Lefevre"]
      );
      await client.query("INSERT INTO chantiers (entreprise_id, client_id, nom) VALUES ($1, $2, $3)", [
        ent[0].id,
        cl[0].id,
        "Abattage Zzz rue des Lilas",
      ]);

      // **LE CONTEXTE EST EFFACÉ AVANT DE JOUER LA MIGRATION, ET C'EST TOUT
      // L'INTÉRÊT DU CONTRÔLE.** Première version : il restait posé pour les
      // insertions ci-dessus, la migration en héritait (`set_config` local vaut
      // pour toute la transaction), et le contrôle passait au vert même après
      // qu'on eut retiré la pose du contexte à l'intérieur de la migration —
      // c'est-à-dire sur la version qui, en production, ne renomme rien.
      //
      // Un contrôle qui ne sait pas échouer ne prouve rien (`AGENTS.md`) :
      // celui-ci a été confronté à la migration défaillante, et il rougit.
      await client.query("SELECT set_config('app.entreprise_id', '', true)");

      await client.query(sql);

      // **La migration efface le contexte derrière elle**, à dessein : elle ne
      // doit rien laisser traîner. Il faut donc le reposer pour relire — sans
      // quoi la relecture rend zéro ligne et le contrôle accuse la migration
      // de n'avoir rien fait. C'est le même piège que celui qu'il surveille,
      // rencontré une seconde fois en l'écrivant.
      await client.query("SELECT set_config('app.entreprise_id', $1, true)", [ent[0].id]);

      const { rows: apres } = await client.query(
        `SELECT cl.nom AS client, c.nom AS chantier
         FROM chantiers c JOIN clients cl ON cl.id = c.client_id
         WHERE cl.nom LIKE '%Zzz %'`
      );
      assert.ok(apres.length >= 4, `seulement ${apres.length} chantier(s) d'épreuve retrouvés`);

      const ecarts: string[] = [];
      for (const ligne of apres) {
        const veut = attendu[ligne.client] ?? "Abattage Zzz rue des Lilas";
        if (ligne.chantier !== veut) {
          ecarts.push(`« ${ligne.client} » : « ${ligne.chantier} » au lieu de « ${veut} »`);
        }
      }
      assert.deepEqual(
        ecarts,
        [],
        "La migration n'a pas renommé ce qu'elle devait :\n      " +
          ecarts.join("\n      ") +
          "\n      (Si TOUS les noms sont restés « Chez … », c'est le contexte " +
          "d'entreprise qui manque — voir l'en-tête de la migration.)"
      );
    } finally {
      await client.query("ROLLBACK");
      client.release();
    }
  });

  await pool.end();

  if (echecs > 0) {
    console.error(`\n${echecs} contrôle(s) en échec.`);
    process.exit(1);
  }
  console.log("\nTous les contrôles de la civilité sont passés.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
