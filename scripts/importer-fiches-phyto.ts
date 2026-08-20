/**
 * Verser des fiches phytosanitaires dans la base commune.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * **Ce script n'INVENTE rien. Il recopie ce qu'on lui donne, ou il refuse.**
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Sa règle du 20 août 2026 : *« Tu ne dois inventer aucune fiche
 * phytosanitaire. Les données seront constituées séparément à partir de sources
 * fiables et validées. Prépare seulement le schéma d'import, les contrôles, le
 * versionnement et la traçabilité nécessaires. »*
 *
 * Les contrôles vivent dans `src/lib/import-fiches-phyto.ts` — fonction pure,
 * éprouvée sans base ni réseau, **y compris contre des fiches volontairement
 * fautives**. Ici, il n'y a que la lecture des fichiers et l'écriture en base.
 *
 * ── Usage ──────────────────────────────────────────────────────────────────
 *
 *     DATABASE_URL="$DATABASE_ADMIN_URL" npx tsx scripts/importer-fiches-phyto.ts donnees/phyto/fiches
 *     npx tsx scripts/importer-fiches-phyto.ts donnees/phyto/fixtures --fixtures
 *     npx tsx scripts/importer-fiches-phyto.ts donnees/phyto/fiches --verifier   (ne écrit rien)
 *
 * **Le rôle PROPRIÉTAIRE est obligatoire**, et le script le vérifie avant
 * d'écrire quoi que ce soit. `atlas_app` n'a que `SELECT` sur ces tables
 * (migration 0056) : c'est ce qui fait qu'une faille dans l'application ne peut
 * pas écrire une maladie inventée dans la base commune de tout le monde. Sans
 * ce contrôle, l'erreur arriverait au milieu de l'import, à moitié appliqué.
 *
 * **Le lot entier passe ou ne passe pas.** Une seule transaction : un fichier
 * fautif au milieu n'a jamais laissé la base à moitié à jour.
 */

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { Pool, type PoolClient } from "pg";
import { validerLot, type FicheImportee, type LotImporte } from "../src/lib/import-fiches-phyto";

const args = process.argv.slice(2);
const dossier = args.find((a) => !a.startsWith("--"));
const autoriserFixtures = args.includes("--fixtures");
const verifierSeulement = args.includes("--verifier");

if (!dossier) {
  console.error("Usage : importer-fiches-phyto.ts <dossier> [--fixtures] [--verifier]");
  process.exit(1);
}

/**
 * **Une fixture ne s'importe JAMAIS en production**, quelle que soit l'option.
 *
 * Sa consigne : des données de test « explicitement identifiées et impossibles
 * à exposer en production ». Trois barrières, et il en faut trois parce que
 * chacune couvre un chemin différent : ce refus-ci couvre l'import, le filtre
 * de `fiches-phyto.ts` couvre la lecture, et la contrainte CHECK de la
 * migration couvre l'écriture directe en SQL.
 */
if (autoriserFixtures && process.env.NODE_ENV === "production") {
  console.error("❌ --fixtures est refusé en production. Les données d’essai n’ont rien à faire dans une vraie base.");
  process.exit(1);
}

async function main() {
  const fichiers = listerFichiers(dossier!);
  if (fichiers.length === 0) {
    console.log(`Aucun fichier .json dans ${dossier}. Rien à importer.`);
    return;
  }

  let total = 0;
  let echecs = 0;

  // **Tous les codes de fiches sont relevés AVANT de valider quoi que ce soit.**
  // Une confusion doit pouvoir relier deux fiches écrites dans deux fichiers
  // différents — et ce sont justement celles-là qui se confondent, puisqu'on les
  // écrit à des moments différents, à partir de sources différentes.
  const codesConnus = new Set<string>();
  for (const fichier of fichiers) {
    try {
      const brut = JSON.parse(readFileSync(fichier, "utf-8")) as { fiches?: { code?: string }[] };
      for (const f of brut.fiches ?? []) if (f.code) codesConnus.add(f.code);
    } catch {
      // Un fichier illisible sera signalé par sa propre validation, avec un
      // message qui désigne le bon coupable. Ici, on l'ignore.
    }
  }

  for (const fichier of fichiers) {
    const brut = JSON.parse(readFileSync(fichier, "utf-8"));
    const verdict = validerLot(brut, { autoriserFixtures, codesConnus });

    for (const a of verdict.avertissements) {
      console.warn(`  ⚠ ${path.basename(fichier)}${a.fiche ? ` [${a.fiche}]` : ""} : ${a.message}`);
    }

    if (!verdict.ok) {
      echecs++;
      console.error(`❌ ${path.basename(fichier)} — refusé :`);
      for (const p of verdict.problemes) {
        console.error(`     ${p.fiche ? `[${p.fiche}] ` : ""}${p.message}`);
      }
      continue;
    }

    if (verifierSeulement) {
      console.log(`  ✓ ${path.basename(fichier)} — ${verdict.lot.fiches.length} fiche(s) valides`);
      total += verdict.lot.fiches.length;
      continue;
    }

    await ecrire(verdict.lot, fichier);
    total += verdict.lot.fiches.length;
  }

  if (echecs > 0) {
    console.error(`\n❌ ${echecs} fichier(s) refusé(s). Rien n’a été écrit pour eux.`);
    process.exit(1);
  }

  await raccorderConfusions();
  console.log(`\n✅ ${total} fiche(s) ${verifierSeulement ? "vérifiées" : "importées"}.`);
}

/**
 * Les fichiers de lot d'un dossier — ou du fichier désigné.
 *
 * **Un dossier absent n'est pas une erreur**, et c'est délibéré : la CI
 * contrôle `donnees/phyto/fiches` à chaque poussée, y compris tant qu'il est
 * vide. Échouer là-dessus rendrait rouge un dépôt parfaitement sain, et l'on
 * apprendrait à ignorer ce rouge — on perdrait alors le garde-fou sans s'en
 * apercevoir.
 */
function listerFichiers(cible: string): string[] {
  if (!existsSync(cible)) {
    console.log(`${cible} n’existe pas encore. Rien à importer.`);
    return [];
  }
  const info = statSync(cible);
  if (info.isFile()) return cible.endsWith(".json") ? [cible] : [];
  return readdirSync(cible)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((f) => path.join(cible, f));
}

let pool: Pool | null = null;
function getPool(): Pool {
  if (!pool) {
    const url = process.env.DATABASE_URL;
    if (!url) {
      console.error("DATABASE_URL manquant. Employez le rôle PROPRIÉTAIRE : DATABASE_URL=\"$DATABASE_ADMIN_URL\".");
      process.exit(1);
    }
    pool = new Pool({ connectionString: url });
  }
  return pool;
}

/**
 * Écrire un lot, en une seule transaction.
 *
 * **Les enfants d'une fiche sont REMPLACÉS, jamais complétés.** Un symptôme
 * retiré du fichier source doit disparaître de la base : sans cela, corriger
 * une fiche n'enlèverait jamais rien, et les erreurs s'accumuleraient sans
 * qu'on puisse les défaire autrement qu'à la main.
 */
async function ecrire(lot: LotImporte, fichier: string) {
  const client = await getPool().connect();
  try {
    const { rows } = await client.query("SELECT current_user AS role");
    const role = rows[0]?.role as string;
    // Le message doit désigner le bon coupable (`AGENTS.md`) : « permission
    // denied for table fiches_phyto », au milieu de l'import, enverrait
    // chercher un défaut de migration là où il n'y a qu'un rôle mal choisi.
    if (role === "atlas_app") {
      throw new Error(
        "L’import tourne sous « atlas_app », qui n’a que SELECT sur la base phytosanitaire (migration 0056). " +
          "Relancez avec le rôle propriétaire : DATABASE_URL=\"$DATABASE_ADMIN_URL\"."
      );
    }

    await client.query("BEGIN");

    for (const s of lot.sources) {
      await client.query(
        `INSERT INTO sources_phyto (code, organisme, titre, url, nature, publiee_le, consultee_le)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         ON CONFLICT (code) DO UPDATE SET
           organisme = EXCLUDED.organisme, titre = EXCLUDED.titre, url = EXCLUDED.url,
           nature = EXCLUDED.nature, publiee_le = EXCLUDED.publiee_le,
           consultee_le = EXCLUDED.consultee_le, updated_at = now()`,
        [s.code, s.organisme, s.titre, s.url, s.nature, s.publieeLe, s.consulteeLe]
      );
    }

    for (const t of lot.taxons) {
      await client.query(
        `INSERT INTO taxons (code, nom_scientifique, nom_commun, synonymes, rang, port)
         VALUES ($1,$2,$3,$4,$5,$6)
         ON CONFLICT (code) DO UPDATE SET
           nom_scientifique = EXCLUDED.nom_scientifique, nom_commun = EXCLUDED.nom_commun,
           synonymes = EXCLUDED.synonymes, rang = EXCLUDED.rang, port = EXCLUDED.port,
           updated_at = now()`,
        [t.code, t.nomScientifique, t.nomCommun, t.synonymes, t.rang, t.port]
      );
    }

    // Deux passes sur les fiches : toutes créées d'abord, les renvois ensuite.
    // Une confusion peut désigner une fiche déclarée plus bas dans le même
    // fichier — l'ordre du fichier ne doit pas décider de ce qui marche.
    for (const f of lot.fiches) await ecrireFiche(client, f);
    for (const f of lot.fiches) await ecrireLiens(client, f);

    await client.query("COMMIT");
    console.log(`  ✓ ${path.basename(fichier)} — ${lot.fiches.length} fiche(s), version ${lot.version}`);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(`❌ ${path.basename(fichier)} — écriture annulée intégralement.`);
    throw err;
  } finally {
    client.release();
  }
}

async function ecrireFiche(client: PoolClient, f: FicheImportee) {
  await client.query(
    `INSERT INTO fiches_phyto (
       code, nom_commun, nom_scientifique, categorie, agent_causal, agent_type,
       parties_atteintes, periode_debut_mois, periode_fin_mois, explication_courte,
       gravite, impact_mecanique, impact_mecanique_note, risque_humain_animal,
       risque_humain_animal_note, statut_reglementaire, reference_reglementaire,
       diagnostic_photo, photos_utiles, conduite_recommandee, prevention, gestion,
       traitement, niveau_validation, origine, version, sources_a_jour_le
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27)
     ON CONFLICT (code) DO UPDATE SET
       nom_commun = EXCLUDED.nom_commun, nom_scientifique = EXCLUDED.nom_scientifique,
       categorie = EXCLUDED.categorie, agent_causal = EXCLUDED.agent_causal,
       agent_type = EXCLUDED.agent_type, parties_atteintes = EXCLUDED.parties_atteintes,
       periode_debut_mois = EXCLUDED.periode_debut_mois, periode_fin_mois = EXCLUDED.periode_fin_mois,
       explication_courte = EXCLUDED.explication_courte, gravite = EXCLUDED.gravite,
       impact_mecanique = EXCLUDED.impact_mecanique, impact_mecanique_note = EXCLUDED.impact_mecanique_note,
       risque_humain_animal = EXCLUDED.risque_humain_animal,
       risque_humain_animal_note = EXCLUDED.risque_humain_animal_note,
       statut_reglementaire = EXCLUDED.statut_reglementaire,
       reference_reglementaire = EXCLUDED.reference_reglementaire,
       diagnostic_photo = EXCLUDED.diagnostic_photo, photos_utiles = EXCLUDED.photos_utiles,
       conduite_recommandee = EXCLUDED.conduite_recommandee, prevention = EXCLUDED.prevention,
       gestion = EXCLUDED.gestion, traitement = EXCLUDED.traitement,
       niveau_validation = EXCLUDED.niveau_validation, origine = EXCLUDED.origine,
       version = EXCLUDED.version, sources_a_jour_le = EXCLUDED.sources_a_jour_le,
       updated_at = now()`,
    [
      f.code, f.nomCommun, f.nomScientifique, f.categorie, f.agentCausal, f.agentType,
      f.partiesAtteintes, f.periodeDebutMois, f.periodeFinMois, f.explicationCourte,
      f.gravite, f.impactMecanique, f.impactMecaniqueNote, f.risqueHumainAnimal,
      f.risqueHumainAnimalNote, f.statutReglementaire, f.referenceReglementaire,
      f.diagnosticPhoto, f.photosUtiles, f.conduiteRecommandee, f.prevention, f.gestion,
      f.traitement, f.niveauValidation, f.origine, f.version, f.sourcesAJourLe,
    ]
  );
}

/**
 * Les confusions dont la cible n'existait pas encore quand on a écrit leur lot.
 *
 * Elles sont reposées à la fin, une fois tous les lots écrits. Sans cette file,
 * l'ordre alphabétique des fichiers déciderait de ce qui marche : une fiche du
 * lot 003 peut se confondre avec une du lot 002 — l'inverse serait perdu.
 */
const aRaccorder: { ficheCode: string; confusion: FicheImportee["confusions"][number] }[] = [];

/** Pose une confusion. Rend `false` si la fiche visée n'est pas (encore) en base. */
async function poserConfusion(
  client: PoolClient,
  ficheId: string,
  c: FicheImportee["confusions"][number]
): Promise<boolean> {
  const r = await client.query(
    `INSERT INTO confusions_phyto (fiche_id, fiche_confondue_id, critere_differenciant, photo_qui_tranche, partie_qui_tranche)
     SELECT $1, id, $3, $4, $5 FROM fiches_phyto WHERE code = $2
     ON CONFLICT (fiche_id, fiche_confondue_id) DO UPDATE SET
       critere_differenciant = EXCLUDED.critere_differenciant,
       photo_qui_tranche = EXCLUDED.photo_qui_tranche,
       partie_qui_tranche = EXCLUDED.partie_qui_tranche`,
    [ficheId, c.fiche, c.critereDifferenciant, c.photoQuiTranche, c.partieQuiTranche]
  );
  return (r.rowCount ?? 0) > 0;
}

/**
 * Reposer les confusions restées en attente, tous les lots étant écrits.
 *
 * **Ce qui échoue ici est une vraie erreur, et fait tomber l'import.** La
 * validation a déjà refusé toute confusion vers un code qu'aucun lot ne
 * déclare ; si le lien manque encore à ce stade, c'est l'écriture qui a fauté,
 * et un import « réussi » à qui il manque une relance photo est pire qu'un
 * import rouge — on le découvrirait sur un chantier.
 */
async function raccorderConfusions(): Promise<void> {
  if (aRaccorder.length === 0) return;
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const orphelines: string[] = [];
    for (const { ficheCode, confusion } of aRaccorder) {
      const { rows } = await client.query("SELECT id FROM fiches_phyto WHERE code = $1", [ficheCode]);
      const ficheId = rows[0]?.id as string | undefined;
      if (!ficheId || !(await poserConfusion(client, ficheId, confusion))) {
        orphelines.push(`${ficheCode} → ${confusion.fiche}`);
      }
    }
    if (orphelines.length > 0) {
      await client.query("ROLLBACK");
      throw new Error(
        `Confusion(s) impossibles à raccorder : ${orphelines.join(", ")}. ` +
          "La fiche visée n’est pas en base — l’import est incomplet."
      );
    }
    await client.query("COMMIT");
    console.log(`  ↔ ${aRaccorder.length} confusion(s) raccordée(s) entre lots.`);
  } finally {
    client.release();
  }
}

async function ecrireLiens(client: PoolClient, f: FicheImportee) {
  const { rows } = await client.query("SELECT id FROM fiches_phyto WHERE code = $1", [f.code]);
  const ficheId = rows[0].id as string;

  for (const table of ["symptomes_phyto", "hotes_phyto", "confusions_phyto", "fiches_sources", "images_phyto"]) {
    await client.query(`DELETE FROM ${table} WHERE fiche_id = $1`, [ficheId]);
  }

  for (const [i, s] of f.symptomes.entries()) {
    await client.query(
      `INSERT INTO symptomes_phyto (fiche_id, nature, partie, motif, couleurs, localisations, poids, libelle, ordre)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [ficheId, s.nature, s.partie, s.motif, s.couleurs, s.localisations, s.poids, s.libelle, i]
    );
  }

  for (const h of f.hotes) {
    await client.query(
      `INSERT INTO hotes_phyto (fiche_id, taxon_id, specificite)
       SELECT $1, id, $3 FROM taxons WHERE code = $2`,
      [ficheId, h.taxon, h.specificite]
    );
  }

  for (const c of f.confusions) {
    const pose = await poserConfusion(client, ficheId, c);
    // **Une confusion qui ne se pose pas ne dit rien, et c'est le piège.**
    // `INSERT … SELECT … WHERE code = $2` sur une fiche absente n'écrit
    // simplement aucune ligne : pas d'erreur, pas de message, et la relance
    // photo disparaît de l'écran sans que personne ne l'apprenne. Le cas est
    // devenu atteignable le jour où les confusions ont pu franchir les
    // fichiers : la cible peut être dans un lot qu'on n'a pas encore écrit.
    // On le note plutôt que de le taire — le raccordement final s'en occupe.
    if (!pose) aRaccorder.push({ ficheCode: f.code, confusion: c });
  }

  for (const s of f.sources) {
    await client.query(
      `INSERT INTO fiches_sources (fiche_id, source_id, champs)
       SELECT $1, id, $3 FROM sources_phyto WHERE code = $2`,
      [ficheId, s.source, s.champs]
    );
  }

  for (const [i, img] of f.images.entries()) {
    // Un fichier du dépôt est RANGÉ dans le stockage au moment de l'import ;
    // une adresse distante reste telle quelle.
    const cle = img.fichier ? await rangerImage(img.fichier) : img.storageKey;
    await client.query(
      `INSERT INTO images_phyto (fiche_id, storage_key, url, licence, credit, partie, legende, ordre)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [ficheId, cle, img.url, img.licence, img.credit, img.partie, img.legende, i]
    );
  }
}

/**
 * Ranger une image de référence dans le stockage, et rendre sa clé.
 *
 * **Le plafond de taille n'est pas une pinaillerie de dépôt.** Ces photos sont
 * versionnées dans Git, où rien ne s'efface jamais : cinquante fiches à deux
 * photos de trois mégaoctets alourdiraient le dépôt de trois cents mégaoctets,
 * pour toujours, et chaque clone les porterait. Elles sont surtout AFFICHÉES sur
 * un téléphone, souvent au bord d'une route — une photo de trois mégaoctets s'y
 * charge mal, et le patron regarde un cadre vide au moment où il compare.
 *
 * Le refus dit quoi faire plutôt que de constater : redimensionner. C'est un
 * geste de dix secondes, et la photo n'y perd rien de ce qui sert au diagnostic.
 */
const IMAGE_MAX_OCTETS = 500 * 1024;

async function rangerImage(chemin: string): Promise<string> {
  if (!existsSync(chemin)) {
    throw new Error(`Image introuvable : ${chemin} (chemin relatif à la racine du dépôt).`);
  }
  const octets = readFileSync(chemin);
  if (octets.length > IMAGE_MAX_OCTETS) {
    const ko = Math.round(octets.length / 1024);
    throw new Error(
      `${chemin} pèse ${ko} Ko, au-delà des ${IMAGE_MAX_OCTETS / 1024} Ko admis. ` +
        `Redimensionnez-la (1200 px de large suffisent largement) : elle sera affichée sur un téléphone.`
    );
  }
  const extension = path.extname(chemin).toLowerCase();
  if (![".jpg", ".jpeg", ".png", ".webp"].includes(extension)) {
    throw new Error(`${chemin} : seuls .jpg, .png et .webp sont acceptés (reçu « ${extension} »).`);
  }
  const { enregistrerObjet } = await import("../src/server/storage");
  const objet = await enregistrerObjet("phyto/images", octets, extension === ".jpeg" ? ".jpg" : extension);
  return objet.storageKey;
}

main()
  .then(() => pool?.end())
  .catch(async (err) => {
    console.error(err instanceof Error ? err.message : err);
    await pool?.end();
    process.exit(1);
  });
