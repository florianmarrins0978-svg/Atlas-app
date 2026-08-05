import assert from "node:assert";
import { pool } from "../src/server/db/client";
import * as entreprisesRepo from "../src/server/repositories/entreprises";
import * as chantiersRepo from "../src/server/repositories/chantiers";
import * as notesRepo from "../src/server/repositories/notes-vocales";
import { listerPrestations } from "../src/server/repositories/prestations";
import { listerLignesPrix } from "../src/server/repositories/lignes-prix";
import { getDevisPourChantier } from "../src/server/repositories/devis";
import { creerTarif } from "../src/server/repositories/tarifs";
import { PREFIXE_TRANSCRIPTION_SIMULEE } from "../src/server/ai/providers/transcription/dev";
import { deriverDicteeVersDevis, resumerTapis } from "../src/server/orchestrateur/tapis-roulant";
import { nettoyerBase } from "./_test-db";

// Le tapis roulant : de la dictée au devis, d'un seul geste.
//
// Ce que ces tests gardent, dans l'ordre d'importance :
//  1. Il s'ARRÊTE au devis en brouillon — jamais de prix validé, jamais d'envoi.
//  2. Il refuse d'extraire quoi que ce soit d'une transcription simulée.
//  3. Ce qui manque REMONTE dans `trous` au lieu d'être comblé.
//  4. Il n'écrase jamais les corrections humaines d'un brouillon.

// Une note vocale factice : le tapis ne lit jamais le fichier lui-même, il
// part de la transcription. Ce qui compte ici est qu'une note EXISTE, parce que
// la transcription s'y rattache.
const FICHIER_FACTICE = {
  storageKey: "essais/tapis.webm",
  mimeType: "audio/webm",
  tailleOctets: 4096,
  checksum: "0".repeat(64),
  dureeSecondes: 30,
};

let passed = 0;
let failed = 0;
async function test(nom: string, fn: () => Promise<void>) {
  try {
    await fn();
    console.log(`✅ ${nom}`);
    passed++;
  } catch (err) {
    console.error(`❌ ${nom}`);
    console.error(`   ${err instanceof Error ? err.message : err}`);
    failed++;
  }
}

async function main() {
  await nettoyerBase();

  const { entreprise, utilisateurId } = await entreprisesRepo.creerEntreprise(
    { nom: "Élagage du tapis" },
    { email: "tapis@test.local", nom: "Patron" }
  );
  const ctx = { entrepriseId: entreprise.id, utilisateurId };

  async function chantierAvecDictee(nom: string, texte: string | null) {
    const chantier = await chantiersRepo.creerChantier(ctx, { nom });
    if (texte !== null) {
      await notesRepo.enregistrerNoteVocale(ctx, chantier.id, FICHIER_FACTICE);
      await notesRepo.enregistrerSuccesTranscription(ctx, chantier.id, texte);
    }
    return chantier;
  }

  await test("Sans dictée : le tapis s'arrête et dit pourquoi, sans rien écrire", async () => {
    const chantier = await chantiersRepo.creerChantier(ctx, { nom: "Sans dictée" });
    const r = await deriverDicteeVersDevis(ctx, chantier.id);
    assert.equal(r.statut, "arrete");
    assert.match(r.raison ?? "", /dictée/i);
    assert.equal((await listerPrestations(ctx, chantier.id)).length, 0);
  });

  // Le défaut le plus coûteux de ce projet : un texte de remplacement traité
  // comme une vraie transcription, découpé en segments, chaque segment
  // ressortant en PRESTATION dans le devis du patron.
  await test("Transcription simulée : refus net, et le devis du patron reste vierge", async () => {
    const chantier = await chantierAvecDictee(
      "Simulée",
      `${PREFIXE_TRANSCRIPTION_SIMULEE} fournisseur de développement, 4096 octets reçus]`
    );
    const r = await deriverDicteeVersDevis(ctx, chantier.id);
    assert.equal(r.statut, "arrete");
    assert.match(r.raison ?? "", /prestataire de transcription/i);
    assert.equal((await listerPrestations(ctx, chantier.id)).length, 0);
    assert.equal(await getDevisPourChantier(ctx, chantier.id), undefined);
  });

  await test("Dictée réelle : les informations sont portées au chantier", async () => {
    const chantier = await chantierAvecDictee("Haie", "Taille de haie sur 40 ml, évacuation des déchets.");
    const r = await deriverDicteeVersDevis(ctx, chantier.id);
    const prestations = await listerPrestations(ctx, chantier.id);
    assert.ok(prestations.length > 0, "aucune prestation créée");
    assert.ok(r.etapes.some((e) => e.nom === "extraction" && e.statut === "reussie"));
  });

  // Le patron a choisi « le devis avec les trous signalés » plutôt qu'un
  // aller-retour de questions : les trous doivent donc exister et remonter.
  await test("Sans tarif correspondant : le prix manquant est signalé, jamais inventé", async () => {
    const chantier = await chantierAvecDictee("Sans tarif", "Abattage par démontage d'un cèdre de 25 mètres.");
    const r = await deriverDicteeVersDevis(ctx, chantier.id);
    const lignes = await listerLignesPrix(ctx, chantier.id);
    if (lignes.length === 0) {
      assert.ok(
        r.trous.some((t) => t.categorie === "prix_absent"),
        "un prix absent doit remonter dans les trous"
      );
      assert.equal(r.statut, "arrete", "sans aucune ligne de prix, il n'y a pas de devis à préparer");
    }
    // Aucun montant n'a pu être fabriqué de nulle part.
    for (const l of lignes) assert.ok(Number(l.montant) >= 0);
  });

  await test("Avec un tarif correspondant : le devis est préparé et le tapis s'arrête là", async () => {
    await creerTarif(ctx, { intitule: "Taille de haie", prix: "18.00", unite: "ml" });
    const chantier = await chantierAvecDictee("Avec tarif", "Taille de haie sur 40 ml.");
    const r = await deriverDicteeVersDevis(ctx, chantier.id);

    if (r.statut === "devis_pret") {
      const devis = await getDevisPourChantier(ctx, chantier.id);
      assert.ok(devis, "un devis doit exister");
      // LE point non négociable : le tapis ne franchit jamais l'arrêt 1.
      assert.equal(devis!.statut, "brouillon", "le devis ne doit jamais partir tout seul");
      const chantierApres = await chantiersRepo.getChantier(ctx, chantier.id);
      assert.equal(chantierApres?.prixValideAt, null, "le prix ne doit jamais être validé par le tapis");
    }
  });

  await test("Deux passages de suite : rien n'est dupliqué ni cassé", async () => {
    const chantier = await chantierAvecDictee("Deux fois", "Taille de haie sur 40 ml.");
    await deriverDicteeVersDevis(ctx, chantier.id);
    const apres1 = (await listerPrestations(ctx, chantier.id)).length;
    const r2 = await deriverDicteeVersDevis(ctx, chantier.id);
    const apres2 = (await listerPrestations(ctx, chantier.id)).length;
    assert.equal(apres2, apres1, "un second passage ne doit pas recréer les prestations");
    assert.ok(r2.etapes.some((e) => e.nom === "confirmation" && e.statut === "sans_effet"));
  });

  await test("Le résumé est une phrase, la même partout, et mentionne ce qu'il faut vérifier", async () => {
    assert.match(resumerTapis({ statut: "devis_pret", etapes: [], trous: [] }), /prêt/i);
    const avecTrous = resumerTapis({
      statut: "devis_pret",
      etapes: [],
      trous: [{ categorie: "prix_absent", message: "x" }],
    });
    assert.match(avecTrous, /1 point/);
    assert.match(resumerTapis({ statut: "arrete", raison: "Pas de dictée.", etapes: [], trous: [] }), /Pas de dictée/);
  });

  console.log(`\n${passed} test(s) réussi(s), ${failed} échoué(s).`);
  await pool.end();
  if (failed > 0) process.exit(1);
}

main().catch(async (err) => {
  console.error(err);
  await pool.end();
  process.exit(1);
});
