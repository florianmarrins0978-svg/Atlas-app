import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { pool } from "../src/server/db/client";
import * as entreprisesRepo from "../src/server/repositories/entreprises";
import { creerChantier } from "../src/server/repositories/chantiers";
import { creerClient } from "../src/server/repositories/clients";
import {
  ajouterPhoto,
  conclureDiagnostic,
  ecrireHypotheses,
  lireDiagnostic,
  lirePhotos,
  listerDiagnostics,
  ouvrirDiagnostic,
  rattacherAUnChantier,
} from "../src/server/repositories/diagnostics";
import { purgerPhotosDiagnostic } from "../src/server/repositories/retention";
import {
  lireBasePourMoteur,
  lireFicheComplete,
  trouverTaxon,
  versionBase,
} from "../src/server/repositories/fiches-phyto";
import { arbitrer, rapprocher, type Observation } from "../src/lib/diagnostic-vegetal";
import type { Ctx } from "../src/server/repositories/context";

/**
 * Le diagnostic végétal, en base : isolation, fixtures, purge, parcours complet.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * **POURQUOI CETTE SUITE EXISTE, ALORS QU'IL Y EN A DÉJÀ UNE POUR LE MOTEUR.**
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Parce que **les suites navigateur ne voient pas les défauts d'isolation**
 * (`CLAUDE.md` §5) : elles démarrent leur serveur sous un rôle qui TRAVERSE la
 * RLS. Un cloisonnement cassé y resterait vert. Cette suite tourne sous
 * `atlas_app`, le rôle réel du produit.
 *
 * Quatre choses qu'aucune autre suite ne peut prouver :
 *
 *  1. **L'isolation** — une entreprise ne voit pas les diagnostics d'une autre,
 *     et cela se vérifie sur des lignes qui existent vraiment.
 *  2. **Les fixtures n'atteignent pas le service** sans la double garde. C'est
 *     sa consigne du 20 août : « impossibles à exposer en production ».
 *  3. **La purge fonctionne SANS contexte d'entreprise** — le piège d'`audios_a_
 *     purger` : un balayage direct ne renverrait rien, *silencieusement*.
 *  4. **Le parcours complet du moteur**, des fixtures jusqu'au verdict, sans
 *     jamais appeler un modèle.
 *
 * Les fixtures employées ici sont chargées par la suite elle-même, et ne
 * décrivent aucun végétal réel (`donnees/phyto/LISEZ-MOI.md`).
 */

// **La double garde, posée par la suite elle-même** — jamais un repli implicite.
// Sans cette ligne, `lireBasePourMoteur` écarte les fixtures, et les cas
// ci-dessous verraient une base vide.
process.env.ATLAS_FIXTURES_PHYTO = "1";

let echecs = 0;
async function cas(nom: string, verifier: () => Promise<void> | void) {
  try {
    await verifier();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.error(`  ✗ ${nom}\n    ${e instanceof Error ? e.message : e}`);
  }
}

async function contexte(suffixe: string): Promise<Ctx> {
  const { entreprise, utilisateurId } = await entreprisesRepo.creerEntreprise(
    { nom: `Atelier ${suffixe}` },
    { email: `diag-${suffixe}-${Date.now()}-${randomUUID().slice(0, 8)}@atlas.test` }
  );
  return { utilisateurId, entrepriseId: entreprise.id };
}

/** Le lot de fixtures, chargé sous le rôle propriétaire, hors de la RLS. */
async function chargerFixtures() {
  const { execSync } = await import("node:child_process");
  execSync(
    `npx tsx scripts/importer-fiches-phyto.ts donnees/phyto/fixtures --fixtures`,
    {
      stdio: "pipe",
      env: {
        ...process.env,
        DATABASE_URL:
          process.env.DATABASE_ADMIN_URL ??
          "postgresql://atlas_owner:atlas_owner_ci_pw@localhost:5432/atlas_test",
      },
    }
  );
}

const RESULTAT_ESSAI = {
  ficheCode: "zz-test-probleme-alpha",
  nom: "Problème d'essai alpha",
  nomScientifique: null,
  confiance: "probable" as const,
  confianceLibelle: "Confiance probable",
  explication: "Donnée d'essai.",
  gravite: "faible" as const,
  graviteLibelle: "Faible",
  conduite: "Donnée d'essai.",
  mentions: [],
  details: {
    categorie: "maladie",
    agentCausal: null,
    agentType: "inconnu",
    partiesAtteintes: ["feuille"],
    prevention: null,
    gestion: null,
    traitement: null,
    sources: [],
    versionFiche: 1,
    sourcesAJourLe: null,
  },
};

/**
 * Lire en SQL brut, **sous le contexte RLS de l'entreprise**.
 *
 * **Le piège que cette fonction évite, et il a failli rendre trois cas verts à
 * tort.** `pool.query` tourne sous `atlas_app` SANS contexte : la RLS renvoie
 * alors zéro ligne, *silencieusement*. Un cas qui compte des lignes aurait donc
 * lu `0` et conclu « rien n'a été écrit » — alors que tout l'avait été. C'est
 * exactement le défaut du 15 août : **un contrôle qui mesure zéro ne mesure
 * rien**, et il est pire qu'absent.
 *
 * `set_config(..., true)` limite la portée à la transaction, comme
 * `withEntreprise` : on n'affaiblit pas la RLS pour éprouver, on l'emprunte.
 */
async function lireSousContexte<T = Record<string, unknown>>(
  ctx: Ctx,
  requete: string,
  parametres: unknown[] = []
): Promise<T[]> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT set_config('app.entreprise_id', $1, true)", [ctx.entrepriseId]);
    const { rows } = await client.query(requete, parametres);
    await client.query("COMMIT");
    return rows as T[];
  } finally {
    client.release();
  }
}

const TRACES = { moteur: "essai", modele: "essai", versionBase: "essai" };
const SANS_ESSENCE = { taxonId: null, certitude: null };

async function main() {
  await chargerFixtures();

  const a = await contexte("A");
  const b = await contexte("B");

  console.log("\n=== La base commune est lisible, et filtrée ===");

  await cas("les fixtures sortent quand la double garde est posée", async () => {
    const base = await lireBasePourMoteur();
    assert.equal(base.vide, false);
    const codes = base.fiches.map((f) => f.code);
    assert.ok(codes.includes("zz-test-probleme-alpha"));
    assert.ok(codes.includes("zz-test-probleme-gamma"));
  });

  await cas("SANS la garde, AUCUNE fixture ne sort — c'est le cas de production", async () => {
    // **Ce cas affirmait « la base est vide », et c'était vrai par ACCIDENT :
    // il n'y avait alors aucune fiche réelle.** La première fiche réelle
    // (`donnees/phyto/fiches/`) l'a fait rougir sur du code juste — le travers
    // que `CLAUDE.md` §5 bis nomme : une suite doit fixer la RÈGLE, pas l'état
    // du moment. La règle, ici, est que les fixtures ne sortent pas ; ce que la
    // base contient par ailleurs ne la regarde pas.
    delete process.env.ATLAS_FIXTURES_PHYTO;
    try {
      const base = await lireBasePourMoteur();
      const fixtures = base.fiches.filter((f) => f.code.startsWith("zz-test-"));
      assert.deepEqual(fixtures, [], "une fixture ne doit jamais atteindre un vrai diagnostic");
    } finally {
      process.env.ATLAS_FIXTURES_PHYTO = "1";
    }
  });

  await cas("les symptômes, hôtes et confusions suivent leurs fiches", async () => {
    const base = await lireBasePourMoteur();
    const alpha = base.fiches.find((f) => f.code === "zz-test-probleme-alpha")!;
    assert.equal(alpha.symptomes.length, 2);
    assert.equal(alpha.hotes.length, 1);

    // **Compter les confusions de la base ENTIÈRE ne prouvait rien**, et n'était
    // vrai que par accident : il n'y avait alors que les fixtures. La première
    // fiche réelle qui déclare une confusion a fait rougir ce cas sur du code
    // juste (`CLAUDE.md` §5 bis). Ce qui doit être fixé, c'est la RÈGLE : la
    // confusion d'alpha existe, et elle nomme la photo qui tranche.
    const beta = base.fiches.find((f) => f.code === "zz-test-probleme-beta")!;
    const sienne = base.confusions.find(
      (c) => c.ficheId === alpha.id && c.ficheConfondueId === beta.id
    );
    assert.ok(sienne, "la confusion d’alpha vers beta doit être lisible par le moteur");
    assert.ok(sienne!.photoQuiTranche, "une confusion qui relance doit dire quoi photographier");
  });

  await cas("une fiche complète rend ses sources, avec les champs qu'elles appuient", async () => {
    const base = await lireBasePourMoteur();
    const alpha = base.fiches.find((f) => f.code === "zz-test-probleme-alpha")!;
    const complet = await lireFicheComplete(alpha.id);
    assert.ok(complet);
    assert.equal(complet!.sources.length, 1);
    assert.ok(complet!.sources[0].champs.includes("conduite_recommandee"));
  });

  await cas("la version de la base situe l'état des fiches", async () => {
    assert.match(await versionBase(), /fiches/);
  });

  await cas("un taxon se retrouve par son nom commun, et par un synonyme", async () => {
    assert.ok(await trouverTaxon(null, "Essence d'essai alpha"));
    assert.ok(await trouverTaxon(null, "alpha d'essai"));
  });

  await cas("un nom inconnu rend `null` plutôt que de deviner", async () => {
    assert.equal(await trouverTaxon("Inexistus fictus", "n'existe pas"), null);
  });

  console.log("\n=== Le parcours complet du moteur, sans aucun appel modèle ===");

  await cas("un SIGNE cardinal sur le tronc conclut nettement", async () => {
    const base = await lireBasePourMoteur();
    const vue: Observation = {
      partie: "tronc",
      signes: [{ partie: "tronc", motif: "carpophore", couleurs: ["brun"], localisation: "base" }],
      essence: null,
      qualitePhoto: "bonne",
    };
    const candidats = rapprocher(vue, base.fiches, 11);
    const verdict = arbitrer(candidats, vue, base.confusions, {
      complementDejaDemande: false,
      baseVide: base.vide,
    });
    assert.equal(verdict.issue, "conclusion");
    assert.equal(verdict.issue === "conclusion" && verdict.candidat.fiche.code, "zz-test-probleme-gamma");
  });

  await cas("deux fiches jumelles déclenchent la demande de photo, avec SA consigne", async () => {
    const base = await lireBasePourMoteur();
    const vue: Observation = {
      partie: "feuille",
      signes: [{ partie: "feuille", motif: "tache", couleurs: ["brun"], localisation: "face_superieure" }],
      essence: null,
      qualitePhoto: "bonne",
    };
    const candidats = rapprocher(vue, base.fiches, 6);
    const verdict = arbitrer(candidats, vue, base.confusions, {
      complementDejaDemande: false,
      baseVide: base.vide,
    });
    assert.equal(verdict.issue, "complement");
    assert.equal(
      verdict.issue === "complement" && verdict.consigne,
      "Photographiez le dessous de la feuille."
    );
  });

  await cas("une fiche « diagnostic photo impossible » n'est jamais rendue", async () => {
    const base = await lireBasePourMoteur();
    const vue: Observation = {
      partie: "racine",
      signes: [{ partie: "racine", motif: "necrose", couleurs: ["noir"], localisation: null }],
      essence: null,
      qualitePhoto: "bonne",
    };
    const candidats = rapprocher(vue, base.fiches, 6);
    assert.ok(candidats.length > 0, "la fiche doit bien être candidate…");
    const verdict = arbitrer(candidats, vue, base.confusions, {
      complementDejaDemande: false,
      baseVide: base.vide,
    });
    // …mais elle ne doit jamais devenir une conclusion.
    assert.equal(verdict.issue, "refus");
    assert.equal(verdict.issue === "refus" && verdict.motif, "diagnostic_photo_impossible");
  });

  console.log("\n=== Isolation entre entreprises ===");

  let diagnosticA = "";

  await cas("un diagnostic s'ouvre et se relit dans sa propre entreprise", async () => {
    diagnosticA = await ouvrirDiagnostic(a);
    const lu = await lireDiagnostic(a, diagnosticA);
    assert.ok(lu);
    assert.equal(lu!.statut, "en_analyse");
  });

  await cas("l'entreprise B ne voit PAS le diagnostic de A", async () => {
    assert.equal(await lireDiagnostic(b, diagnosticA), null);
  });

  await cas("B ne voit pas non plus les photos de A", async () => {
    await ajouterPhoto(
      a,
      diagnosticA,
      {
        storageKey: `essai/${randomUUID()}.jpg`,
        mimeType: "image/jpeg",
        tailleOctets: 100,
        checksum: "abc",
        role: "initiale",
        partieDemandee: null,
        exifRetire: true,
      },
      { libreJours: 0, chantierJours: 0 }
    );
    assert.equal((await lirePhotos(a, diagnosticA)).length, 1);
    assert.equal((await lirePhotos(b, diagnosticA)).length, 0);
  });

  await cas("la liste de B ne contient rien de A", async () => {
    const listeA = await listerDiagnostics(a);
    const listeB = await listerDiagnostics(b);
    assert.ok(listeA.some((d) => d.id === diagnosticA));
    assert.equal(listeB.some((d) => d.id === diagnosticA), false);
  });

  await cas("B ne peut pas conclure le diagnostic de A", async () => {
    await conclureDiagnostic(
      b,
      diagnosticA,
      { type: "inconclusif", motif: "aucune_piste", phrase: "détourné" },
      null,
      TRACES,
      SANS_ESSENCE
    );
    const lu = await lireDiagnostic(a, diagnosticA);
    assert.equal(lu!.statut, "en_analyse", "l’écriture de B ne doit pas avoir porté");
  });

  console.log("\n=== Le résultat est FIGÉ, et la traçabilité écrite ===");

  await cas("conclure écrit le résultat, la confiance et les trois traces", async () => {
    const base = await lireBasePourMoteur();
    const alpha = base.fiches.find((f) => f.code === "zz-test-probleme-alpha")!;
    await conclureDiagnostic(
      a,
      diagnosticA,
      { type: "rendu", ficheId: alpha.id, confiance: "probable", resultat: RESULTAT_ESSAI },
      { signes: [] },
      { moteur: "essai", modele: "modele-essai", versionBase: "4 fiches" },
      SANS_ESSENCE
    );
    const lu = await lireDiagnostic(a, diagnosticA);
    assert.equal(lu!.statut, "rendu");
    assert.equal(lu!.confiance, "probable");
    assert.equal(lu!.moteur, "essai");
    assert.equal(lu!.modele, "modele-essai");
    assert.equal(lu!.versionBase, "4 fiches");
    assert.equal((lu!.resultat as typeof RESULTAT_ESSAI).nom, "Problème d'essai alpha");
  });

  await cas("les hypothèses internes sont rangées, en millièmes entiers", async () => {
    const base = await lireBasePourMoteur();
    await ecrireHypotheses(
      a,
      diagnosticA,
      base.fiches.slice(0, 3).map((f, i) => ({ ficheId: f.id, score: 0.5 - i * 0.1, motifs: [] }))
    );
    const rows = await lireSousContexte<{ score: number; rang: number }>(
      a,
      "SELECT score, rang FROM hypotheses_diagnostic WHERE diagnostic_id = $1 ORDER BY rang",
      [diagnosticA]
    );
    assert.equal(rows.length, 3);
    assert.equal(rows[0].score, 500);
    assert.ok(Number.isInteger(rows[0].score));
  });

  console.log("\n=== Une seule relance : l'invariant tient AUSSI en base ===");

  await cas("la contrainte CHECK refuse un second complément", async () => {
    const id = await ouvrirDiagnostic(a);
    await conclureDiagnostic(
      a,
      id,
      { type: "complement", consigne: "Photographiez autre chose.", partie: "feuille" },
      null,
      TRACES,
      SANS_ESSENCE
    );
    // **On n'épingle PAS le texte du message**, et c'est délibéré : l'ORM
    // enveloppe l'erreur de PostgreSQL, et un contrôle accroché à cette
    // formulation rougirait à la prochaine montée de version sur du code juste.
    // Ce qui compte est qu'il y ait refus.
    await assert.rejects(
      conclureDiagnostic(
        a,
        id,
        { type: "complement", consigne: "Encore une.", partie: "feuille" },
        null,
        TRACES,
        SANS_ESSENCE
      ),
      "le code borne déjà à une relance ; la base doit le border aussi"
    );
  });

  await cas("et la contrainte est bien celle qu'on croit, lue dans le catalogue", async () => {
    const { rows } = await pool.query(
      `SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint
       WHERE conrelid = 'diagnostics'::regclass AND conname = 'diagnostics_complements_ck'`
    );
    assert.equal(rows.length, 1, "la contrainte doit exister");
    assert.match(rows[0].def, /complements_demandes <= 1/);
  });

  console.log("\n=== Rattachement à un chantier, et ce qu'il change à la purge ===");

  let diagnosticRattache = "";
  let chantierId = "";

  await cas("un diagnostic né SANS chantier peut en recevoir un après coup", async () => {
    const client = await creerClient(a, { nom: "Client d'essai" });
    const chantier = await creerChantier(a, { clientId: client.id, nom: "Chantier d'essai" });
    chantierId = chantier.id;

    diagnosticRattache = await ouvrirDiagnostic(a);
    const avant = await lireDiagnostic(a, diagnosticRattache);
    assert.equal(avant!.chantierId, null, "le diagnostic est autonome par défaut");

    const r = await rattacherAUnChantier(a, diagnosticRattache, chantierId, {
      libreJours: 90,
      chantierJours: 0,
    });
    assert.equal(r.ok, true);
    const apres = await lireDiagnostic(a, diagnosticRattache);
    assert.equal(apres!.chantierId, chantierId);
  });

  await cas("B ne peut pas rattacher un diagnostic de A à son propre chantier", async () => {
    const r = await rattacherAUnChantier(b, diagnosticRattache, chantierId, {
      libreJours: 90,
      chantierJours: 0,
    });
    assert.equal(r.ok, false);
  });

  await cas("le rattachement RECALCULE l'échéance de purge des photos", async () => {
    const id = await ouvrirDiagnostic(a);
    await ajouterPhoto(
      a,
      id,
      {
        storageKey: `essai/${randomUUID()}.jpg`,
        mimeType: "image/jpeg",
        tailleOctets: 100,
        checksum: "abc",
        role: "initiale",
        partieDemandee: null,
        exifRetire: true,
      },
      { libreJours: 90, chantierJours: 0 }
    );
    const avant = await lireSousContexte<{ n: number }>(
      a,
      "SELECT count(*)::int AS n FROM photos_diagnostic_a_purger p JOIN photos_diagnostic d ON d.id = p.photo_id WHERE d.diagnostic_id = $1",
      [id]
    );
    assert.equal(avant[0].n, 1, "une photo libre est programmée pour disparaître");

    await rattacherAUnChantier(a, id, chantierId, { libreJours: 90, chantierJours: 0 });
    const apres = await lireSousContexte<{ n: number }>(
      a,
      "SELECT count(*)::int AS n FROM photos_diagnostic_a_purger p JOIN photos_diagnostic d ON d.id = p.photo_id WHERE d.diagnostic_id = $1",
      [id]
    );
    // Sans ce recalcul, la pièce d'un dossier toujours en cours disparaîtrait
    // au bout de trois mois sans que personne l'ait demandé.
    assert.equal(apres[0].n, 0, "versée au dossier, la photo ne doit plus être programmée");
  });

  console.log("\n=== La purge planifiée, SANS contexte d'entreprise ===");

  await cas("une photo échue est purgée, et le diagnostic lui SURVIT", async () => {
    const id = await ouvrirDiagnostic(a);
    const cle = `essai/${randomUUID()}.jpg`;
    await ajouterPhoto(
      a,
      id,
      {
        storageKey: cle,
        mimeType: "image/jpeg",
        tailleOctets: 100,
        checksum: "abc",
        role: "initiale",
        partieDemandee: null,
        exifRetire: true,
      },
      { libreJours: 1, chantierJours: 0 }
    );

    // On avance l'échéance plutôt que le temps : c'est la seule chose qu'une
    // suite peut faire sans attendre un jour.
    await pool.query(
      "UPDATE photos_diagnostic_a_purger SET purger_le = now() - interval '1 hour' WHERE storage_key = $1",
      [cle]
    );

    const { photosPurgees } = await purgerPhotosDiagnostic();
    assert.ok(photosPurgees >= 1, "la purge doit trouver la photo depuis la file, sans contexte d’entreprise");

    const photos = await lirePhotos(a, id);
    assert.equal(photos.length, 0, "la photo purgée ne se liste plus");
    const lu = await lireDiagnostic(a, id);
    assert.ok(lu, "le diagnostic, lui, survit à sa photo");

    const { rows } = await pool.query(
      "SELECT count(*)::int AS n FROM fichiers_a_purger WHERE storage_key = $1",
      [cle]
    );
    assert.equal(rows[0].n, 1, "l’objet est mis en file de suppression, jamais détruit dans la transaction");
  });

  await cas("une photo NON échue n'est pas touchée", async () => {
    const id = await ouvrirDiagnostic(a);
    const cle = `essai/${randomUUID()}.jpg`;
    await ajouterPhoto(
      a,
      id,
      {
        storageKey: cle,
        mimeType: "image/jpeg",
        tailleOctets: 100,
        checksum: "abc",
        role: "initiale",
        partieDemandee: null,
        exifRetire: true,
      },
      { libreJours: 90, chantierJours: 0 }
    );
    await purgerPhotosDiagnostic();
    assert.equal((await lirePhotos(a, id)).length, 1);
  });

  console.log("\n=== Les fixtures restent repérables et supprimables ===");

  await cas("une seule requête suffit à savoir si une base en porte", async () => {
    const { rows } = await pool.query(
      "SELECT count(*)::int AS n FROM fiches_phyto WHERE origine = 'fixture_test'"
    );
    assert.equal(rows[0].n, 4);
    const { rows: horsPrefixe } = await pool.query(
      "SELECT count(*)::int AS n FROM fiches_phyto WHERE origine = 'fixture_test' AND code NOT LIKE 'zz-test-%'"
    );
    assert.equal(horsPrefixe[0].n, 0, "la contrainte CHECK garantit le préfixe dans les deux sens");
  });

  console.log("\n=== Une confusion peut relier deux LOTS différents ===");

  /**
   * **Le défaut que ce cas fixe, et pourquoi il était muet.**
   *
   * Les fiches qui se confondent s'écrivent à des moments différents, donc dans
   * des fichiers différents : l'anthracnose du platane et celle du chêne
   * donnent la même nécrose brune sur une feuille, et vivent dans deux lots.
   * Une fois le contrôle élargi pour l'admettre, l'écriture, elle, restait
   * posée en `INSERT … SELECT … WHERE code = $2` — qui, sur une fiche pas
   * encore écrite, n'insère **rien du tout, sans une erreur ni un message**.
   * L'ordre alphabétique des fichiers décidait donc de ce qui marchait, et la
   * relance photo disparaissait de l'écran sans que personne ne l'apprenne.
   *
   * Le lot « amont » est nommé pour passer AVANT le lot « aval » au tri : c'est
   * le renvoi vers l'avant, celui qui était perdu.
   */
  await cas("un renvoi vers une fiche d’un lot écrit PLUS TARD est bien posé", async () => {
    const { mkdtempSync, writeFileSync, rmSync } = await import("node:fs");
    const { tmpdir } = await import("node:os");
    const { join } = await import("node:path");
    const { execSync } = await import("node:child_process");

    const dossier = mkdtempSync(join(tmpdir(), "atlas-lots-"));
    try {
      const lot = (code: string, confusions: unknown[]) => ({
        version: "fixtures-renvoi",
        sources: [
          {
            code: "zz-test-source-technique",
            organisme: "Source d'essai",
            titre: "Document d'essai",
            nature: "technique",
            consulteeLe: "2026-08-20",
          },
        ],
        taxons: [],
        fiches: [
          {
            code,
            nomCommun: `Renvoi d'essai ${code}`,
            categorie: "maladie",
            partiesAtteintes: ["feuille"],
            explicationCourte: "Donnée d'essai.",
            gravite: "faible",
            diagnosticPhoto: "possible",
            conduiteRecommandee: "Donnée d'essai.",
            niveauValidation: "validee",
            origine: "fixture_test",
            sourcesAJourLe: "2026-08-20",
            symptomes: [{ nature: "symptome", partie: "feuille", motif: "tache" }],
            sources: [{ source: "zz-test-source-technique", champs: ["conduite_recommandee", "gravite"] }],
            confusions,
          },
        ],
      });

      writeFileSync(
        join(dossier, "1-amont.json"),
        JSON.stringify(
          lot("zz-test-renvoi-amont", [
            {
              fiche: "zz-test-renvoi-aval",
              critereDifferenciant: "Donnée d'essai.",
              photoQuiTranche: "Donnée d'essai.",
              partieQuiTranche: "feuille",
            },
          ])
        )
      );
      writeFileSync(join(dossier, "2-aval.json"), JSON.stringify(lot("zz-test-renvoi-aval", [])));

      execSync(`npx tsx scripts/importer-fiches-phyto.ts ${dossier} --fixtures`, {
        stdio: "pipe",
        env: {
          ...process.env,
          DATABASE_URL:
            process.env.DATABASE_ADMIN_URL ??
            "postgresql://atlas_owner:atlas_owner_ci_pw@localhost:5432/atlas_test",
        },
      });

      const { rows } = await pool.query(
        `SELECT c.photo_qui_tranche, c.partie_qui_tranche
           FROM confusions_phyto c
           JOIN fiches_phyto f ON f.id = c.fiche_id
           JOIN fiches_phyto g ON g.id = c.fiche_confondue_id
          WHERE f.code = 'zz-test-renvoi-amont' AND g.code = 'zz-test-renvoi-aval'`
      );
      assert.equal(rows.length, 1, "le renvoi vers le lot suivant n’a pas été posé — il s’est perdu en silence");
      assert.equal(rows[0].partie_qui_tranche, "feuille", "la partie à photographier doit survivre au raccordement");
    } finally {
      // Ces deux fiches ne servent qu'ici : les laisser fausserait le compte de
      // fixtures que le cas précédent vérifie, au prochain passage.
      await pool.query("DELETE FROM fiches_phyto WHERE code IN ('zz-test-renvoi-amont','zz-test-renvoi-aval')");
      rmSync(dossier, { recursive: true, force: true });
    }
  });

  console.log(
    echecs === 0 ? `\n✅ Toutes les vérifications passent.` : `\n❌ ${echecs} vérification(s) en échec.`
  );
  await pool.end();
  process.exit(echecs === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error(e);
  await pool.end();
  process.exit(1);
});
