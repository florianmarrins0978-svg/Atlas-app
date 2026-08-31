// LA BASE ET LE STOCKAGE DISENT-ILS LA MÊME CHOSE ?
//
// ═════════════════════════════════════════════════════════════════════════════
// **CE QUE CE CONTRÔLE ATTRAPE, ET QUE PERSONNE D'AUTRE NE PEUT ATTRAPER.**
//
// Atlas range ses octets dans un stockage objet et n'en garde que la clé en
// base. Les deux se sauvegardent **séparément**, et se restaurent séparément :
// rien ne garantit qu'ils reviennent au même instant.
//
// D'où deux dégâts, invisibles l'un comme l'autre tant qu'on ne les cherche pas :
//
// | | |
// |---|---|
// | **une clé sans objet** | la facture existe, son PDF a disparu. L'artisan clique, et rien ne vient |
// | **un objet sans clé** | l'octet est payé tous les mois et ne sert plus à personne |
//
// Ni PostgreSQL, ni Scaleway, ni aucun outil de sauvegarde ne peut le voir : il
// faut savoir QUELLES colonnes portent une clé, et c'est une connaissance propre
// à Atlas (`src/lib/objets-stockes.ts`).
//
// ═════════════════════════════════════════════════════════════════════════════
// **CE QU'IL REFUSE DE FAIRE.**
//
// **Il ne conclut jamais sur zéro.** Une base vide, un stockage injoignable, un
// rôle sans droits : dans ces cas-là il n'y a rien À mesurer, et « aucun écart
// trouvé » serait un mensonge en vert. C'est la règle de `CLAUDE.md` §5, et elle
// a déjà été payée dans ce dépôt.
//
// **Il n'accuse pas ce qui est normal.** L'audio d'une note vocale disparaît
// sept jours après sa transcription : c'est la purge, c'est voulu. Rougir
// dessus reviendrait à interdire la purge. Chaque colonne dit elle-même si une
// absence est grave, et pourquoi.
//
// ═════════════════════════════════════════════════════════════════════════════
// **COMMENT ON LE JOUE.**
//
//     npx tsx scripts/verifier-coherence-fichiers.ts
//     npx tsx scripts/verifier-coherence-fichiers.ts --orphelins   # + le sens inverse
//
// Il lui faut un rôle qui TRAVERSE la RLS — les 34 tables en `FORCE ROW LEVEL
// SECURITY` soumettent même leur propriétaire, et un rôle ordinaire compterait
// zéro ligne partout. Mesuré le 27 août 2026 : `atlas_app` et `atlas_owner`
// voient zéro, seul le superutilisateur voit les données.

import { Pool } from "pg";
import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import { COLONNES_OBJET, requeteDesCles, type ColonneObjet } from "../src/lib/objets-stockes";
// Le dossier vient de sa source, jamais d'une copie : voir le commentaire posé
// sur `RACINE_STOCKAGE`.
import { RACINE_STOCKAGE } from "../src/server/storage/local-storage";

const CHERCHER_ORPHELINS = process.argv.includes("--orphelins");

/** Ce que le contrôle a trouvé, colonne par colonne. */
type Constat = {
  colonne: ColonneObjet;
  clesEnBase: number;
  manquantes: string[];
};

/**
 * Le stockage à interroger.
 *
 * **On ne passe PAS par `src/server/storage`**, et c'est délibéré : ce module
 * refuse le stockage local dès que l'environnement ressemble à une production,
 * ce qui est juste pour le produit et faux pour un outil de diagnostic. Un
 * contrôle qui ne peut pas tourner là où le défaut se trouve ne sert à rien.
 */
async function lecteurDeStockage(): Promise<{
  nom: string;
  existe: (cle: string) => Promise<boolean>;
  lister?: () => Promise<string[]>;
}> {
  const s3 = process.env.STORAGE_S3_BUCKET;
  if (s3) {
    const { S3Client, HeadObjectCommand, ListObjectsV2Command } = await import("@aws-sdk/client-s3");
    const client = new S3Client({
      region: process.env.STORAGE_S3_REGION ?? "fr-par",
      endpoint: process.env.STORAGE_S3_ENDPOINT,
      forcePathStyle: Boolean(process.env.STORAGE_S3_ENDPOINT),
      credentials: {
        accessKeyId: process.env.STORAGE_S3_ACCESS_KEY_ID ?? "",
        secretAccessKey: process.env.STORAGE_S3_SECRET_ACCESS_KEY ?? "",
      },
    });
    return {
      nom: `S3 « ${s3} »`,
      existe: async (cle) => {
        try {
          await client.send(new HeadObjectCommand({ Bucket: s3, Key: cle }));
          return true;
        } catch {
          return false;
        }
      },
      lister: async () => {
        const cles: string[] = [];
        let suite: string | undefined;
        do {
          const r = await client.send(
            new ListObjectsV2Command({ Bucket: s3, ContinuationToken: suite })
          );
          for (const o of r.Contents ?? []) if (o.Key) cles.push(o.Key);
          suite = r.IsTruncated ? r.NextContinuationToken : undefined;
        } while (suite);
        return cles;
      },
    };
  }

  const racine = RACINE_STOCKAGE;
  return {
    nom: `disque local « ${racine} »`,
    existe: async (cle) => {
      try {
        await stat(path.join(racine, cle));
        return true;
      } catch {
        return false;
      }
    },
    lister: async () => {
      const cles: string[] = [];
      async function descendre(d: string, prefixe: string) {
        let entrees;
        try {
          entrees = await readdir(d, { withFileTypes: true });
        } catch {
          return;
        }
        for (const e of entrees) {
          const sous = prefixe ? `${prefixe}/${e.name}` : e.name;
          if (e.isDirectory()) await descendre(path.join(d, e.name), sous);
          else cles.push(sous);
        }
      }
      await descendre(racine, "");
      return cles;
    },
  };
}

async function main() {
  console.log("=== La base et le stockage disent-ils la même chose ? ===\n");

  const url =
    process.env.DATABASE_SUPER_URL ?? process.env.DATABASE_ADMIN_URL ?? process.env.DATABASE_URL;
  if (!url) {
    console.error(
      "❌ Aucune adresse de base (DATABASE_SUPER_URL, DATABASE_ADMIN_URL, DATABASE_URL).\n" +
        "   Sans elle il n'y a rien à comparer — et un contrôle sans matière ne prouve rien."
    );
    process.exit(2);
  }

  const pool = new Pool({ connectionString: url });

  // ─── LE DROIT DE VOIR, DEMANDÉ AU MOTEUR — jamais déduit d'un compte ────────
  //
  // **Ce garde-fou remplace une première version qui rendait un FAUX VERT**, vu
  // à l'essai le 27 août 2026. Elle refusait de conclure « si le total des clés
  // vaut zéro » — un raisonnement qui paraît solide et qui ne l'est pas : deux
  // tables (`fichiers_a_purger`, `images_phyto`) ne sont pas cloisonnées par
  // entreprise et rendent des lignes à n'importe quel rôle. Sous `atlas_app`, le
  // contrôle voyait donc 3 clés sur des dizaines, ne déclenchait pas son
  // garde-fou, et annonçait « base et stockage cohérents » en ayant ignoré neuf
  // colonnes sur onze.
  //
  // Le droit de traverser la RLS est un FAIT que PostgreSQL connaît. On le lui
  // demande, au lieu de le deviner.
  const { rows: qui } = await pool.query<{
    role: string;
    super: boolean;
    traverse: boolean;
  }>("SELECT current_user AS role, rolsuper AS super, rolbypassrls AS traverse FROM pg_roles WHERE rolname = current_user");
  const moi = qui[0];
  if (!moi || (!moi.super && !moi.traverse)) {
    console.error(
      `❌ Le rôle « ${moi?.role ?? "inconnu"} » ne traverse pas la RLS.\n\n` +
        "   34 tables d'Atlas sont en FORCE ROW LEVEL SECURITY : elles la font\n" +
        "   respecter MÊME à leur propriétaire. Ce contrôle verrait donc zéro\n" +
        "   ligne sur la plupart des tables — et quelques-unes sur les rares qui\n" +
        "   ne sont pas cloisonnées, ce qui suffirait à lui faire annoncer un\n" +
        "   vert parfaitement faux.\n\n" +
        "   Il refuse plutôt que de mesurer une fraction de la base.\n" +
        "   Poser DATABASE_SUPER_URL sur un rôle superutilisateur, et rejouer."
    );
    await pool.end().catch(() => undefined);
    process.exit(2);
  }

  const stockage = await lecteurDeStockage();
  console.log(`  Rôle : ${moi.role} (${moi.super ? "superutilisateur" : "BYPASSRLS"})`);
  console.log(`  Stockage interrogé : ${stockage.nom}\n`);

  const constats: Constat[] = [];
  let totalCles = 0;

  for (const c of COLONNES_OBJET) {
    let lignes: Array<{ cle: string }>;
    try {
      ({ rows: lignes } = await pool.query(requeteDesCles(c)));
    } catch (e) {
      // Une table illisible n'est pas un écart de cohérence : c'est que la base
      // n'est pas celle qu'on croit. On le DIT, plutôt que de compter zéro.
      //
      // **ET ON DÉSIGNE LE BON COUPABLE.** La première version de ce message
      // accusait « le schéma ou les droits » quoi qu'il arrive — y compris
      // quand PostgreSQL était simplement ÉTEINT. Vu à l'essai, le 27 août
      // 2026 : « connect ECONNREFUSED » suivi de « le rôle n'a pas le droit de
      // la lire ». Une erreur qui envoie chercher au mauvais endroit coûte plus
      // cher que pas d'erreur du tout (`AGENTS.md`).
      const brut = (e as Error).message.split("\n")[0];
      console.log(`  ⚠ ${c.table}.${c.colonne} : illisible — ${brut}`);
      await pool.end().catch(() => undefined);
      const injoignable = /ECONNREFUSED|ENOTFOUND|ETIMEDOUT|terminated unexpectedly|does not exist/i.test(brut);
      console.error(
        injoignable
          ? "\n❌ La base n'a pas répondu. Ce n'est pas un défaut de cohérence :\n" +
              "   le serveur est éteint, injoignable, ou la base nommée n'existe pas.\n" +
              "   Rien n'a été mesuré."
          : "\n❌ Une colonne attendue n'a pas pu être lue. La base a répondu, mais\n" +
              "   pas ce qu'on attendait : soit elle n'a pas le schéma d'Atlas, soit\n" +
              "   le rôle employé n'a pas le droit de la lire."
      );
      process.exit(2);
    }

    totalCles += lignes.length;
    const manquantes: string[] = [];
    for (const l of lignes) {
      if (!(await stockage.existe(l.cle))) manquantes.push(l.cle);
    }
    constats.push({ colonne: c, clesEnBase: lignes.length, manquantes });
  }

  // ─── LE GARDE-FOU : refuser de conclure sur rien ────────────────────────────
  //
  // Zéro clé partout, ce n'est pas « tout est cohérent ». C'est soit une base
  // vide, soit un rôle qui ne voit rien à cause de la RLS — et dans les deux cas
  // ce contrôle n'a mesuré ABSOLUMENT RIEN. Le laisser rendre un vert ferait
  // exactement ce que `CLAUDE.md` §5 interdit.
  if (totalCles === 0) {
    console.error(
      "❌ AUCUNE clé de fichier trouvée dans TOUTE la base.\n\n" +
        "   Ce contrôle refuse de conclure : il n'a rien mesuré.\n\n" +
        "   Le droit de traverser la RLS a déjà été vérifié plus haut : ce n'est\n" +
        "   donc pas une affaire de rôle. La base est réellement vide, ou ce\n" +
        "   n'est pas celle qu'on croit."
    );
    await pool.end();
    process.exit(2);
  }

  // ─── Le compte-rendu ────────────────────────────────────────────────────────
  let graves = 0;
  let tolerees = 0;

  for (const k of constats) {
    if (k.clesEnBase === 0) continue;
    const n = k.manquantes.length;
    if (n === 0) {
      console.log(`  ✓ ${k.colonne.table}.${k.colonne.colonne} — ${k.clesEnBase} clé(s), toutes présentes`);
      continue;
    }
    if (k.colonne.absenceNormale) {
      tolerees += n;
      console.log(
        `  · ${k.colonne.table}.${k.colonne.colonne} — ${n}/${k.clesEnBase} absente(s), ` +
          `et c'est normal : ${k.colonne.raisonAbsence}`
      );
      continue;
    }
    graves += n;
    console.log(`  ✗ ${k.colonne.table}.${k.colonne.colonne} — ${n}/${k.clesEnBase} MANQUANTE(S)`);
    console.log(`      ${k.colonne.quoi} — la ligne existe, le fichier n'est plus là`);
    for (const cle of k.manquantes.slice(0, 5)) console.log(`      · ${cle}`);
    if (n > 5) console.log(`      · … et ${n - 5} autre(s)`);
  }

  // ─── Le sens inverse : des objets que plus rien ne réclame ──────────────────
  let orphelins = 0;
  if (CHERCHER_ORPHELINS && stockage.lister) {
    const toutes = new Set<string>();
    for (const c of COLONNES_OBJET) {
      const { rows } = await pool.query(requeteDesCles(c));
      for (const r of rows) toutes.add(r.cle);
    }
    const dansLeStockage = await stockage.lister();
    const sansReference = dansLeStockage.filter((k) => !toutes.has(k));
    orphelins = sansReference.length;
    console.log("");
    if (orphelins === 0) {
      console.log(`  ✓ aucun objet orphelin (${dansLeStockage.length} objet(s) inspecté(s))`);
    } else {
      // **Un orphelin n'est PAS une erreur**, et le dire autrement ferait
      // supprimer des fichiers à tort : la file de purge attend 24 h avant de
      // retirer un objet remplacé. Ce qu'on veut savoir, c'est le VOLUME.
      console.log(
        `  · ${orphelins} objet(s) que plus aucune ligne ne réclame, sur ${dansLeStockage.length}.`
      );
      console.log("      Ce n'est pas un défaut : la purge attend 24 h. C'est un coût de stockage.");
      for (const k of sansReference.slice(0, 5)) console.log(`      · ${k}`);
    }
  }

  await pool.end();

  console.log("");
  console.log(`  ${totalCles} clé(s) de fichier vérifiée(s) sur ${COLONNES_OBJET.length} colonnes.`);
  if (tolerees > 0) console.log(`  ${tolerees} absence(s) attendue(s) — purges et brouillons.`);

  if (graves > 0) {
    console.error(`\n❌ ${graves} fichier(s) manquant(s) qui NE DEVRAIENT PAS l'être.`);
    console.error("   La base et le stockage ne sont pas au même instant.");
    process.exit(1);
  }
  console.log("\n✅ Base et stockage cohérents.");
}

main().catch(async (e) => {
  console.error("❌ Contrôle interrompu :", e instanceof Error ? e.message : e);
  process.exit(2);
});
